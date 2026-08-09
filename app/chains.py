import json

from langchain_core.documents import Document
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.runnables import RunnableLambda
from langchain_core.runnables.history import RunnableWithMessageHistory

from app.createai_llm import get_createai_model
from app.llm import get_model
from app.memory import get_session_history
from app.prompts import (
    CLASSIFY_REVIEW_PROMPT,
    CONVERSATION_PROMPT,
    INTENT_EXTRACTION_PROMPT,
    INTENT_EXTRACTION_PROMPT_TEXT_ONLY,
    ORDER_PARSE_PROMPT,
    RECOMMEND_PROMPT,
)
from app.retrievers import get_menu_retriever
from app.schemas import FoodQuery, OrderDraftItem, ReviewClassification
from app.tools import find_menu_item_id, resolve_modifications

# --- Path A: Ollama (llama3), native structured output ---------------------
# with_structured_output binds the FoodQuery schema directly to the model's
# tool-calling interface. The model is asked to "call a function" whose
# arguments match FoodQuery — LangChain parses those arguments into the
# Pydantic object for you.
ollama_model = get_model()
ollama_structured_model = ollama_model.with_structured_output(FoodQuery)
ollama_parse_chain = INTENT_EXTRACTION_PROMPT | ollama_structured_model

# --- Path B: ASU CreateAI, manual structured output -------------------------
# CreateAI's /query endpoint only does plain text completion — no tool
# calling, no JSON mode flag. So instead of binding a schema to the model,
# we do it the classic way: tell the model the schema IN THE PROMPT TEXT
# (via format_instructions), get raw text back, and parse that text
# ourselves with PydanticOutputParser. This is what with_structured_output
# does under the hood for models that can't do it natively.
createai_model = get_createai_model()
_parser = PydanticOutputParser(pydantic_object=FoodQuery)
createai_prompt = INTENT_EXTRACTION_PROMPT_TEXT_ONLY.partial(
    format_instructions=_parser.get_format_instructions()
)
createai_parse_chain = createai_prompt | createai_model | _parser

# Default chain used by main.py. Change this line to switch which model
# powers the terminal app.
parse_chain = createai_parse_chain


# --- Phase 2: RAG — retrieve real menu items, then explain the matches ----
# Mirrors the spec's diagram exactly:
#   FoodQuery -> retriever.invoke(query, filter=...) -> [Documents] -> prompt -> model -> answer
#
# This can't be a single static "prompt | model" pipe because the retriever's
# metadata filter depends on the FoodQuery, which is only known per-request.
# RunnableLambda wraps a plain Python function as a Runnable so it can still
# sit inside a `|` chain like everything else.
def _format_docs(docs: list[Document]) -> str:
    return "\n\n".join(d.page_content for d in docs)


def _retrieve(inputs: dict) -> dict:
    query: FoodQuery = inputs["query"]
    text: str = inputs["text"]
    retriever = get_menu_retriever(query, k=5)
    docs = retriever.invoke(text)
    return {"context": _format_docs(docs), "question": text, "_docs": docs}


recommend_chain = RunnableLambda(_retrieve) | RECOMMEND_PROMPT | createai_model


def recommend(text: str):
    """Full Phase 1 + Phase 2 pipeline: raw text -> FoodQuery -> grounded recommendation."""
    query = parse_chain.invoke({"text": text})
    retrieved = _retrieve({"query": query, "text": text})
    answer = (RECOMMEND_PROMPT | createai_model).invoke(
        {"context": retrieved["context"], "question": text}
    )
    return query, retrieved["_docs"], answer


# --- Phase 3: multi-turn memory ---------------------------------------------
# RunnableWithMessageHistory wraps a chain so that, on every .invoke(), it:
#   1. looks up get_session_history(session_id)
#   2. injects those past messages into the "chat_history" placeholder
#   3. runs the chain
#   4. appends BOTH the new human input and the new AI reply back into that
#      same history, so the NEXT call sees them too
# Nothing here is magic — it's exactly the "append to a list, replay it"
# mechanism described in app/memory.py, just automated by LangChain instead
# of you writing that bookkeeping by hand.
_conversation_chain = CONVERSATION_PROMPT | createai_model

conversational_concierge = RunnableWithMessageHistory(
    _conversation_chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="chat_history",
)


# --- Phase 6: structured output under pressure ------------------------------
# order_parse_chain = messy sentence -> validated NESTED OrderDraftItem.
# Same text-only path as createai_parse_chain (CreateAI can't tool-call, so we
# spell the schema out via format_instructions and parse the reply), but the
# schema is now nested, and the prompt forbids the model from evaluating any
# condition. That "record, don't decide" split is the whole Phase 6 point.
_order_parser = PydanticOutputParser(pydantic_object=OrderDraftItem)
order_parse_prompt = ORDER_PARSE_PROMPT.partial(
    format_instructions=_order_parser.get_format_instructions()
)
order_parse_chain = order_parse_prompt | createai_model | _order_parser


def parse_and_resolve_order(text: str):
    """Full Phase 6 pipeline: raw order text -> nested OrderDraftItem (LLM =
    language) -> resolve_modifications against real modifier data (tools =
    truth). Returns (order, resolved_dict). resolved is None if we can't map
    the item name to a real menu item.
    """
    order: OrderDraftItem = order_parse_chain.invoke({"text": text})

    item_id = find_menu_item_id(order.item)
    if item_id is None:
        return order, None

    mods = [m.model_dump() for m in order.modifications]
    resolved = json.loads(
        resolve_modifications.invoke({"item_id": item_id, "modifications": mods})
    )
    return order, resolved


# --- Phase 8: review intelligence (the "map" chain) -------------------------
# classify_review_chain turns ONE review's text into a ReviewClassification.
# Same CreateAI text-only path as the other parsers. The reporting trick is to
# run this over MANY reviews with .batch() (LCEL parallelism) and then aggregate
# the labels — see app/analytics.py.
_review_class_parser = PydanticOutputParser(pydantic_object=ReviewClassification)
classify_review_prompt = CLASSIFY_REVIEW_PROMPT.partial(
    format_instructions=_review_class_parser.get_format_instructions()
)
classify_review_chain = classify_review_prompt | createai_model | _review_class_parser
