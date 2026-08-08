from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory

# Every session's conversation lives here as a plain Python dict, in RAM.
# session_id -> the list of messages exchanged so far. This is the "no
# magic" honest version of memory: nothing is saved to disk, so restarting
# the process wipes every conversation. That's the exact limitation Phase 10+
# (LangGraph checkpointing) fixes later.
_store: dict[str, InMemoryChatMessageHistory] = {}


def get_session_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in _store:
        _store[session_id] = InMemoryChatMessageHistory()
    return _store[session_id]
