from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    ollama_base_url: str = "http://localhost:11434"
    ollama_api_key: str = "ollama"
    lmstudio_base_url: str = "http://localhost:1234"
    lmstudio_api_key: str = "lm-studio"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    default_llm_provider: str = "ollama"
    default_llm_model: str = "llama3.2"

    embedding_provider: str = "local"
    openai_embedding_model: str = "text-embedding-3-small"

    host: str = "127.0.0.1"
    port: int = 8765

    vector_store_path: Path = Path("vectorstore")
    db_path: Path = Path("data.db")



