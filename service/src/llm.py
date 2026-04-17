import os
from typing import AsyncGenerator
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama

from src.config import settings


class LLMManager:
    def __init__(self):
        self._llms = {}

    def _convert_messages(
        self, messages: list[dict], system_prompt: str | None = None
    ) -> list:
        langchain_messages = []
        if system_prompt:
            langchain_messages.append(SystemMessage(content=system_prompt))

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                langchain_messages.append(SystemMessage(content=content))
            elif role == "user":
                langchain_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                langchain_messages.append(AIMessage(content=content))

        return langchain_messages

    def get_llm(self, provider: str | None = None, model: str | None = None):
        provider = provider or settings.default_llm_provider
        model = model or settings.default_llm_model
        key = f"{provider}:{model}"

        if key not in self._llms:
            if provider == "ollama":
                self._llms[key] = ChatOllama(
                    base_url=settings.ollama_base_url,
                    model=model,
                )
            elif provider == "lmstudio":
                self._llms[key] = ChatOpenAI(
                    base_url=settings.lmstudio_base_url,
                    api_key=settings.lmstudio_api_key,
                    model=model,
                )
            elif provider == "deepseek":
                self._llms[key] = ChatOpenAI(
                    base_url=settings.deepseek_base_url,
                    api_key=settings.deepseek_api_key,
                    model=model,
                )
            elif provider == "openai":
                self._llms[key] = ChatOpenAI(
                    api_key=settings.openai_api_key,
                    model=model,
                )
            elif provider == "claude":
                from langchain_anthropic import ChatAnthropic
                self._llms[key] = ChatAnthropic(
                    anthropic_api_key=settings.anthropic_api_key,
                    model=model,
                )
            else:
                raise ValueError(f"Unknown provider: {provider}")

        return self._llms[key]

    async def chat(
        self,
        messages: list[dict],
        provider: str | None = None,
        model: str | None = None,
        system_prompt: str | None = None,
    ) -> str:
        llm = self.get_llm(provider, model)
        langchain_messages = self._convert_messages(messages, system_prompt)

        try:
            response = await llm.ainvoke(langchain_messages)
            return response.content
        except Exception as e:
            raise RuntimeError(f"LLM chat failed: {e}") from e

    async def stream_chat(
        self,
        messages: list[dict],
        provider: str | None = None,
        model: str | None = None,
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        llm = self.get_llm(provider, model)
        langchain_messages = self._convert_messages(messages, system_prompt)

        try:
            async for chunk in llm.astream(langchain_messages):
                if hasattr(chunk, "content") and chunk.content:
                    yield chunk.content
        except Exception as e:
            raise RuntimeError(f"LLM stream_chat failed: {e}") from e


llm_manager = LLMManager()