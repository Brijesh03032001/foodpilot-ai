from langchain_core.documents import Document
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.runnables import RunnableLambda
from langchain_core.runnables.history import RunnableWithMessageHistory

from app.createai_llm import get_createai_model
from app.llm import get_model
from app.memory import get_session_history
from app.prompts import (
    CONVERSATION_PROMPT,
    INTENT_EXTRACTION_PROMPT,
    INTENT_EXTRACTION_PROMPT_TEXT_ONLY,
    RECOMMEND_PROMPT,
)
from app.retrievers import get_menu_retriever
from app.schemas import FoodQuery

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
