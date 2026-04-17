import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from src.llm import LLMManager


def test_llm_manager_initialization():
    manager = LLMManager()
    assert manager._llms == {}


def test_get_llm_ollama():
    manager = LLMManager()
    with patch("src.llm.ChatOllama") as mock_ollama:
        llm = manager.get_llm(provider="ollama", model="llama3.2")
        mock_ollama.assert_called_once()
        assert llm is not None


def test_get_llm_lmstudio():
    manager = LLMManager()
    with patch("src.llm.ChatOpenAI") as mock_openai:
        llm = manager.get_llm(provider="lmstudio", model="local-model")
        mock_openai.assert_called_once()
        assert llm is not None


def test_get_llm_caching():
    manager = LLMManager()
    with patch("src.llm.ChatOllama") as mock_ollama:
        llm1 = manager.get_llm(provider="ollama", model="llama3.2")
        llm2 = manager.get_llm(provider="ollama", model="llama3.2")
        assert mock_ollama.call_count == 1
        assert llm1 is llm2


def test_get_llm_unknown_provider():
    manager = LLMManager()
    with pytest.raises(ValueError, match="Unknown provider: unknown"):
        manager.get_llm(provider="unknown", model="model")


def test_chat_message_conversion():
    manager = LLMManager()
    mock_llm = AsyncMock()
    mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="Test response"))
    manager._llms["ollama:llama3.2"] = mock_llm

    messages = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there"}
    ]

    import asyncio
    result = asyncio.run(manager.chat(messages, provider="ollama", model="llama3.2"))
    assert result == "Test response"
    mock_llm.ainvoke.assert_called_once()


def test_chat_with_system_prompt():
    manager = LLMManager()
    mock_llm = AsyncMock()
    mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="Response"))
    manager._llms["ollama:llama3.2"] = mock_llm

    messages = [{"role": "user", "content": "Hello"}]
    system_prompt = "You are a helpful assistant"

    import asyncio
    result = asyncio.run(manager.chat(
        messages,
        provider="ollama",
        model="llama3.2",
        system_prompt=system_prompt
    ))
    assert result == "Response"
    call_args = mock_llm.ainvoke.call_args
    langchain_messages = call_args[0][0]
    assert len(langchain_messages) == 2
    assert langchain_messages[0].content == system_prompt


@pytest.mark.asyncio
async def test_stream_chat():
    manager = LLMManager()
    mock_chunk1 = MagicMock(content="Hello")
    mock_chunk2 = MagicMock(content=" World")
    mock_llm = AsyncMock()
    mock_llm.astream = AsyncMock(return_value=AsyncMock(__aiter__=lambda self: iter([mock_chunk1, mock_chunk2])))
    manager._llms["ollama:llama3.2"] = mock_llm

    messages = [{"role": "user", "content": "Hi"}]

    result = []
    async for chunk in manager.stream_chat(messages, provider="ollama", model="llama3.2"):
        result.append(chunk)

    assert result == ["Hello", " World"]