from langchain_ollama import ChatOllama


def get_model(temperature: float = 0.0) -> ChatOllama:
    """Return the chat model FoodPilot talks to.

    Centralized here so every other file asks THIS function for a model
    instead of constructing ChatOllama(...) directly. Swapping providers
    later (e.g. to ChatOpenAI or ChatAnthropic) means editing one function,
    not every file that uses a model.
    """
    return ChatOllama(model="llama3", temperature=temperature)


def get_tool_model(temperature: float = 0.0) -> ChatOllama:
    """Return a model that supports native tool-calling (Phases 4-5).

    Uses `qwen3:4b` — a reasoning ("thinking") model that chains multi-step
    tool calls far more reliably than llama3.2 3B (which hallucinated the
    chain). Trade-off: it's slower and verbose because it emits hidden
    <think> blocks before acting. num_ctx is bumped to 16384 so those long
    reasoning traces don't overflow the default 4096 context and force a
    mid-run context shift (which truncated a FEED ME run on the default).

    Not usable here: CreateAI (our ChatCreateAI wrapper is text-in/text-out,
    no tool interface) and plain `llama3` ("does not support tools", HTTP 400).
    """
    return ChatOllama(model="qwen3:4b", temperature=temperature, num_ctx=16384)
