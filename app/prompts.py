from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

INTENT_EXTRACTION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You extract structured food ordering preferences from a customer's "
            "message. Only fill in fields the customer actually mentioned or "
            "clearly implied. Leave everything else at its default.",
        ),
        ("human", "{text}"),
    ]
)

# Used with models that have no native tool-calling / JSON mode (e.g. CreateAI).
# {format_instructions} is filled in by PydanticOutputParser.get_format_instructions() —
# it's literally the schema spelled out in the prompt text, since the model has
# no other way to "know" the shape we want back.
INTENT_EXTRACTION_PROMPT_TEXT_ONLY = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You extract structured food ordering preferences from a customer's "
            "message. Only fill in fields the customer actually mentioned or "
            "clearly implied. Leave everything else at its default.\n\n"
            "{format_instructions}",
        ),
        ("human", "{text}"),
    ]
)

# Phase 2: turn retrieved menu-item Documents + the customer's original
# request into a grounded recommendation. "Using ONLY the context" is the
# key instruction — it's what stops the model from inventing dishes that
# aren't in our data.
RECOMMEND_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a food truck recommendation assistant. Using ONLY the "
            "menu items listed in the context below, recommend items that "
            "match the customer's request. For each recommendation, briefly "
            "explain WHY it fits (price, spice, diet, etc). If nothing in "
            "the context truly fits, say so honestly instead of inventing "
            "an item.\n\nContext (menu items available right now):\n{context}",
        ),
        ("human", "{question}"),
    ]
)

# Phase 3: a multi-turn concierge. MessagesPlaceholder("chat_history") is
# where every PRIOR turn gets replayed back to the model, in full, on every
# single call — that's the entire mechanism behind "memory" here.
CONVERSATION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are FoodPilot's food ordering concierge. Have a natural "
            "back-and-forth with the customer. Pay close attention to every "
            "preference, restriction, or budget they mention across the "
            "conversation, and keep applying ALL of them, not just the most "
            "recent one. When they ask for a recommendation, summarize the "
            "full set of constraints they've given you so far before "
            "answering.",
        ),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ]
)

# Phase 6: parse a messy order sentence into the nested OrderDraftItem schema.
# The critical instruction is "record the condition, do NOT evaluate it" — that
# is the LLM=language / tools=truth boundary, enforced in the prompt itself.
# {format_instructions} is filled by PydanticOutputParser (same text-only path
# as Phase 1's CreateAI chain), and it now describes a NESTED schema.
ORDER_PARSE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You convert a customer's food order into structured data. Extract "
            "the menu item, the total quantity, and each modification: how many "
            "units it applies to, what to add, what to remove, and any condition "
            "attached. Capture conditions EXACTLY as stated, as a short text "
            "expression like 'price <= 2' — do NOT decide whether the condition "
            "is true or false; a separate tool checks that against real prices. "
            "Only fill in what the customer actually said.\n\n"
            "{format_instructions}",
        ),
        ("human", "{text}"),
    ]
)

# Phase 8: classify ONE review into sentiment + topics. The allowed labels come
# in via {format_instructions} (built from the ReviewClassification Literals),
# which is what keeps labels consistent across a whole batch of reviews.
CLASSIFY_REVIEW_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You classify a single customer review for a food truck. Decide the "
            "overall sentiment and which topic categories it mentions. Use ONLY "
            "the allowed topic labels below; if a point doesn't fit any, use "
            "'other'. A review may touch several topics.\n\n"
            "{format_instructions}",
        ),
        ("human", "{text}"),
    ]
)
