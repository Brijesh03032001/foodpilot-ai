import os
from typing import Any

import httpx
from dotenv import load_dotenv
from langchain_core.callbacks import CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, SystemMessage, AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult

load_dotenv()


class ChatCreateAI(BaseChatModel):
    """LangChain chat model wrapper around ASU CreateAI's /query endpoint.

    CreateAI takes one combined prompt string and returns one text response —
    no native tool-calling / JSON mode like OpenAI or Anthropic have. That's
    why it can't use .with_structured_output() the way ChatOllama can; see
    app/chains.py for the PydanticOutputParser-based alternative this model
    uses instead.
    """

    query_url: str
    access_token: str
    timeout: float = 60.0

    @property
    def _llm_type(self) -> str:
        return "createai"

    @staticmethod
    def _messages_to_query(messages: list[BaseMessage]) -> str:
        system_parts = [str(m.content) for m in messages if isinstance(m, SystemMessage)]
        human_parts = [str(m.content) for m in messages if not isinstance(m, SystemMessage)]
        system_prompt = "\n".join(system_parts)
        user_prompt = "\n".join(human_parts)
        return f"{system_prompt}\n\n{user_prompt}" if system_prompt else user_prompt

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        query = self._messages_to_query(messages)

        with httpx.Client(
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
            },
            timeout=self.timeout,
        ) as client:
            response = client.post(self.query_url, json={"query": query})
            response.raise_for_status()
            body = response.json()

        if "response" not in body:
            raise RuntimeError(f"CreateAI query error: {body.get('message', body)}")

        message = AIMessage(content=body["response"])
        return ChatResult(generations=[ChatGeneration(message=message)])


def get_createai_model() -> ChatCreateAI:
    # No temperature knob: CreateAI's /query endpoint doesn't expose one —
    # it's controlled server-side by the model ASU configured behind the token.
    access_token = os.getenv("CREATEAI_ACCESS_TOKEN")
    query_url = os.getenv("CREATEAI_QUERY_URL", "https://api-main.aiml.asu.edu/query")
    if not access_token:
        raise RuntimeError("CREATEAI_ACCESS_TOKEN environment variable is not set.")
    return ChatCreateAI(query_url=query_url, access_token=access_token)
