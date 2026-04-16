# Zotero AI 阅读助手插件 - 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 开发 Zotero 插件，实现 AI 阅读助手功能（问答、总结、语义搜索、笔记增强）

**架构：** 插件 + 本地服务分离架构。Zotero 插件通过 HTTP 与 Python FastAPI 服务通信，后端处理 PDF 解析、向量化、LLM 调用。

**技术栈：**
- Zotero 插件: TypeScript + Zotero Plugin Toolkit
- Python 服务: FastAPI + LangChain + FAISS
- 向量存储: FAISS + SQLite
- AI 服务: Ollama/LM Studio (本地) + DeepSeek/OpenAI/Claude API

---

## 文件结构

```
ai-reader-zotero-plugin/
├── service/                      # Python 后端服务
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 入口
│   │   ├── config.py             # 配置管理
│   │   ├── pdf_processor.py      # PDF 解析
│   │   ├── chunker.py           # 文本分块
│   │   ├── vector_store.py       # FAISS 向量存储
│   │   ├── rag_search.py         # RAG 搜索 (BM25 + 向量)
│   │   ├── llm.py               # LLM 调用封装
│   │   └── routes/              # API 路由
│   │       ├── __init__.py
│   │       ├── chat.py          # 问答接口
│   │       ├── index.py          # 索引接口
│   │       └── search.py         # 搜索接口
│   ├── tests/                   # 测试
│   ├── requirements.txt
│   └── .env.example
│
├── plugin/                      # Zotero 插件
│   ├── addon/
│   │   ├── manifest.json
│   │   ├── bootstrap.js
│   │   └── content/
│   │       └── ai-panel.xhtml
│   ├── src/
│   │   ├── index.ts
│   │   ├── hooks.ts
│   │   ├── modules/
│   │   │   ├── api-client.ts    # 后端 API 客户端
│   │   │   ├── ai-chat.ts       # AI 问答 UI
│   │   │   └── search.ts        # 语义搜索 UI
│   │   └── utils/
│   │       └── config.ts        # 插件配置
│   ├── package.json
│   └── tsconfig.json
│
└── docs/
    └── 2026-04-17-zotero-ai-reader-design.md
```

---

## 第一阶段：Python 后端服务

### Task 1: 项目初始化和配置

**Files:**
- Create: `service/requirements.txt`
- Create: `service/.env.example`
- Create: `service/src/__init__.py`
- Create: `service/src/config.py`

- [ ] **Step 1: 创建 requirements.txt**

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
pydantic-settings==2.5.2
python-multipart==0.0.12
PyMuPDF==1.25.2
langchain==0.3.7
langchain-community==0.3.5
faiss-cpu==1.8.0
numpy==1.26.4
python-dotenv==1.0.1
httpx==0.27.2
sse-starlette==2.1.0
openai==1.54.0
anthropic==0.38.0
```

- [ ] **Step 2: 创建 .env.example**

```env
# LLM 服务配置 (支持 Ollama/LM Studio/OpenAI/DeepSeek/Claude)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_API_KEY=ollama
LMSTUDIO_BASE_URL=http://localhost:1234
LMSTUDIO_API_KEY=lm-studio
DEEPSEEK_API_KEY=sk-xxxx
OPENAI_API_KEY=sk-xxxx
ANTHROPIC_API_KEY=sk-xxxx

# 默认 LLM 提供者: ollama | lmstudio | deepseek | openai | claude
DEFAULT_LLM_PROVIDER=ollama
DEFAULT_LLM_MODEL=llama3.2

# Embedding 配置
EMBEDDING_PROVIDER=local  # local | openai | deepseek
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# 服务配置
HOST=127.0.0.1
PORT=8765
```

- [ ] **Step 3: 创建 config.py**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # LLM providers
    ollama_base_url: str = "http://localhost:11434"
    ollama_api_key: str = "ollama"
    lmstudio_base_url: str = "http://localhost:1234"
    lmstudio_api_key: str = "lm-studio"
    deepseek_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Default LLM
    default_llm_provider: str = "ollama"
    default_llm_model: str = "llama3.2"

    # Embedding
    embedding_provider: str = "local"
    openai_embedding_model: str = "text-embedding-3-small"

    # Server
    host: str = "127.0.0.1"
    port: int = 8765

    # Storage
    vector_store_path: Path = Path("vectorstore")
    db_path: Path = Path("data.db")


settings = Settings()
settings.vector_store_path.mkdir(parents=True, exist_ok=True)
```

- [ ] **Step 4: 提交**

```bash
git init ai-reader-zotero-plugin
cd ai-reader-zotero-plugin
git add service/requirements.txt service/.env.example service/src/
git commit -m "feat(service): initial project structure"
```

---

### Task 2: PDF 解析和文本分块

**Files:**
- Create: `service/src/pdf_processor.py`
- Create: `service/src/chunker.py`
- Create: `service/tests/test_pdf_processor.py`

- [ ] **Step 1: 创建 pdf_processor.py**

```python
from pathlib import Path
import pymupdf
from langchain_core.documents import Document


class PDFProcessor:
    def __init__(self, pdf_path: str | Path):
        self.pdf_path = Path(pdf_path)
        self.doc = None

    def extract_metadata(self) -> dict:
        self.doc = pymupdf.open(str(self.pdf_path))
        return {
            "title": self.doc.metadata.get("title", ""),
            "author": self.doc.metadata.get("author", ""),
            "pages": len(self.doc),
            "file_name": self.pdf_path.name,
        }

    def extract_toc(self) -> list[dict]:
        if self.doc is None:
            self.extract_metadata()
        toc = self.doc.get_toc()
        chapters = []
        for i, item in enumerate(toc):
            level = item[0]
            title = item[1].strip() if len(item) > 1 else f"章节{i+1}"
            page_num = item[2] - 1 if len(item) > 2 else 0
            chapters.append({"level": level, "title": title, "page": page_num})
        return chapters

    def extract_chapters(self) -> list[dict]:
        if self.doc is None:
            self.extract_metadata()

        toc = self.extract_toc()
        if not toc:
            return [{"title": "全文", "start_page": 0, "end_page": len(self.doc) - 1, "text": ""}]

        chapters = []
        for i, item in enumerate(toc):
            start_page = item["page"]
            end_page = toc[i + 1]["page"] - 1 if i + 1 < len(toc) else len(self.doc) - 1

            text_parts = []
            for page_num in range(start_page, end_page + 1):
                if page_num < len(self.doc):
                    text = self.doc[page_num].get_text("text")
                    if text.strip():
                        text_parts.append(text)

            chapters.append({
                "level": item["level"],
                "title": item["title"],
                "start_page": start_page,
                "end_page": end_page,
                "text": "\n".join(text_parts),
            })
        return chapters

    def close(self):
        if self.doc:
            self.doc.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def extract_pdf(pdf_path: str | Path) -> tuple[list[Document], dict]:
    processor = PDFProcessor(pdf_path)
    metadata = processor.extract_metadata()
    chapters = processor.extract_chapters()

    documents = []
    for i, chapter in enumerate(chapters):
        doc = Document(
            page_content=chapter.get("text", ""),
            metadata={
                "chapter_index": i,
                "chapter_title": chapter.get("title", f"第{i+1}章"),
                "chapter_level": chapter.get("level", 1),
                "start_page": chapter.get("start_page", 0),
                "end_page": chapter.get("end_page", 0),
                "source": str(pdf_path),
            }
        )
        documents.append(doc)

    processor.close()
    return documents, metadata
```

- [ ] **Step 2: 创建 chunker.py**

```python
import re
from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter


class ChineseTextSplitter(RecursiveCharacterTextSplitter):
    def __init__(self, separators: list[str] | None = None, **kwargs):
        if separators is None:
            separators = ["\n\n", "\n", "。", "！", "？", "；", "，", "、", " ", ""]
        super().__init__(separators=separators, **kwargs)


class SemanticChunker:
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.splitter = ChineseTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )

    def chunk_documents(self, documents: list[Document]) -> list[Document]:
        chunked = []
        for doc in documents:
            chunks = self.splitter.split_documents([doc])
            for i, chunk in enumerate(chunks):
                chunk.metadata["chunk_index"] = i
                chunk.metadata["chunk_id"] = (
                    f"{doc.metadata.get('source', 'unknown')}"
                    f"_ch{doc.metadata.get('chapter_index', 0)}"
                    f"_k{i}"
                )
                chunked.append(chunk)
        return chunked
```

- [ ] **Step 3: 创建测试文件**

```python
import pytest
from pathlib import Path
from src.pdf_processor import PDFProcessor, extract_pdf
from src.chunker import SemanticChunker


def test_pdf_processor():
    # 需要一个测试 PDF 文件
    pass  # TODO: 添加实际测试


def test_chunker():
    from langchain_core.documents import Document
    chunker = SemanticChunker(chunk_size=100, chunk_overlap=20)
    docs = [Document(page_content="这是测试内容" * 50, metadata={"chapter_index": 0})]
    chunks = chunker.chunk_documents(docs)
    assert len(chunks) > 0
    assert chunks[0].metadata["chunk_id"] is not None
```

- [ ] **Step 4: 提交**

```bash
git add service/src/pdf_processor.py service/src/chunker.py service/tests/
git commit -m "feat(service): add PDF processor and chunker"
```

---

### Task 3: LLM 调用封装

**Files:**
- Create: `service/src/llm.py`
- Create: `service/tests/test_llm.py`

- [ ] **Step 1: 创建 llm.py**

```python
import os
from typing import AsyncGenerator
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama

from src.config import settings


class LLMManager:
    def __init__(self):
        self._llms = {}

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
                    base_url="https://api.deepseek.com",
                    api_key=settings.deepseek_api_key,
                    model=model,
                )
            elif provider == "openai":
                self._llms[key] = ChatOpenAI(
                    api_key=settings.openai_api_key,
                    model=model,
                )
            elif provider == "claude":
                # Claude 使用专门的客户端
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

        response = await llm.ainvoke(langchain_messages)
        return response.content

    async def stream_chat(
        self,
        messages: list[dict],
        provider: str | None = None,
        model: str | None = None,
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        llm = self.get_llm(provider, model)

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

        async for chunk in llm.astream(langchain_messages):
            if hasattr(chunk, "content") and chunk.content:
                yield chunk.content


llm_manager = LLMManager()
```

- [ ] **Step 2: 提交**

```bash
git add service/src/llm.py
git commit -m "feat(service): add LLM manager supporting multiple providers"
```

---

### Task 4: 向量存储和 RAG 搜索

**Files:**
- Create: `service/src/vector_store.py`
- Create: `service/src/rag_search.py`
- Create: `service/tests/test_rag_search.py`

- [ ] **Step 1: 创建 vector_store.py**

```python
import pickle
import json
from pathlib import Path
from typing import Callable

import numpy as np
import faiss
from langchain_core.documents import Document

from src.config import settings


class VectorStore:
    def __init__(self, store_path: Path | None = None):
        self.store_path = Path(store_path or settings.vector_store_path)
        self.index_path = self.store_path / "faiss_index.bin"
        self.metadata_path = self.store_path / "metadata.json"
        self.texts = []
        self.metadatas = []
        self.index = None

    def add_documents(self, documents: list[Document], embeddings: list[list[float]]) -> None:
        self.texts = [doc.page_content for doc in documents]
        self.metadatas = [doc.metadata for doc in documents]

        dim = len(embeddings[0])
        self.index = faiss.IndexFlatIP(dim)

        norm_embeddings = self._normalize(embeddings)
        self.index.add(np.array(norm_embeddings).astype("float32"))

        self._save()

    def _normalize(self, embeddings: list[list[float]]) -> np.ndarray:
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return np.array(embeddings) / norms

    def search(self, query_embedding: list[float], k: int = 5, filter_fn: Callable | None = None) -> list[Document]:
        if self.index is None:
            self._load()

        norm_query = self._normalize([query_embedding])[0]
        scores, indices = self.index.search(
            np.array([norm_query]).astype("float32"), k * 2 if filter_fn else k
        )

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.texts):
                continue

            metadata = self.metadatas[idx]
            if filter_fn and not filter_fn(metadata):
                continue

            doc = Document(
                page_content=self.texts[idx],
                metadata={**metadata, "score": float(score)}
            )
            results.append(doc)

            if len(results) >= k:
                break

        return results

    def _save(self) -> None:
        self.store_path.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, str(self.index_path))
        with open(self.metadata_path, "w", encoding="utf-8") as f:
            json.dump({"texts": self.texts, "metadatas": self.metadatas}, f, ensure_ascii=False)

    def _load(self) -> None:
        if not self.index_path.exists():
            raise FileNotFoundError("Vector store not found")
        self.index = faiss.read_index(str(self.index_path))
        with open(self.metadata_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.texts = data["texts"]
            self.metadatas = data["metadatas"]

    def exists(self) -> bool:
        return self.index_path.exists() and self.metadata_path.exists()
```

- [ ] **Step 2: 创建 rag_search.py**

```python
import re
from collections import defaultdict
import numpy as np
from langchain_core.documents import Document

from src.vector_store import VectorStore


class BM25:
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_freqs = {}
        self.avg_doc_len = 0
        self.doc_lens = []
        self.doc_texts = []
        self.N = 0

    def _tokenize(self, text: str) -> list[str]:
        return re.findall(r"[\w]+", text.lower())

    def index(self, documents: list[str]) -> None:
        self.doc_texts = [self._tokenize(doc) for doc in documents]
        self.doc_lens = [len(doc) for doc in self.doc_texts]
        self.avg_doc_len = sum(self.doc_lens) / len(self.doc_lens) if self.doc_lens else 0
        self.N = len(self.doc_texts)

        self.doc_freqs = defaultdict(int)
        for doc in self.doc_texts:
            for term in set(doc):
                self.doc_freqs[term] += 1

    def get_scores(self, query: str) -> list[float]:
        query_terms = self._tokenize(query)
        scores = []

        for i, doc in enumerate(self.doc_texts):
            score = 0.0
            doc_len = self.doc_lens[i]

            term_freqs = defaultdict(int)
            for term in doc:
                term_freqs[term] += 1

            for term in query_terms:
                if term not in term_freqs:
                    continue
                tf = term_freqs[term]
                df = self.doc_freqs.get(term, 0)
                if df == 0:
                    continue

                idf = np.log((self.N - df + 0.5) / (df + 0.5) + 1)
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / self.avg_doc_len)
                score += idf * numerator / denominator

            scores.append(score)
        return scores

    def get_top_k(self, query: str, k: int = 5) -> list[tuple[int, float]]:
        scores = self.get_scores(query)
        indexed_scores = list(enumerate(scores))
        indexed_scores.sort(key=lambda x: x[1], reverse=True)
        return indexed_scores[:k]


class RAGSearch:
    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store
        self.bm25 = BM25()
        self._bm25_indexed = False

    def index_for_bm25(self, texts: list[str]) -> None:
        self.bm25.index(texts)
        self._bm25_indexed = True

    def hybrid_search(
        self,
        query: str,
        query_embedding: list[float] | None = None,
        k: int = 5,
        rrf_k: int = 60,
    ) -> list[Document]:
        if query_embedding and self._bm25_indexed:
            bm25_scores = self._get_bm25_scores(query)
            # 向量搜索
            vector_results = self.vector_store.search(query_embedding, k=k * 2)
            # 融合
            return self._rrf_fusion(vector_results, bm25_scores, k, rrf_k)
        elif self._bm25_indexed:
            # 纯 BM25
            top_docs = self.bm25.get_top_k(query, k=k)
            results = []
            for idx, score in top_docs:
                if idx < len(self.vector_store.texts):
                    doc = Document(
                        page_content=self.vector_store.texts[idx],
                        metadata={**self.vector_store.metadatas[idx], "score": float(score)}
                    )
                    results.append(doc)
            return results
        else:
            # 纯向量搜索
            return self.vector_store.search(query_embedding, k=k)

    def _get_bm25_scores(self, query: str) -> dict[str, float]:
        top_docs = self.bm25.get_top_k(query, k=50)
        scores = {}
        for idx, score in top_docs:
            chunk_id = self.vector_store.metadatas[idx].get("chunk_id", str(idx))
            scores[chunk_id] = score
        return scores

    def _rrf_fusion(
        self,
        vector_results: list[Document],
        bm25_scores: dict[str, float],
        k: int,
        rrf_k: int,
    ) -> list[Document]:
        fused_scores = {}

        for rank, doc in enumerate(vector_results):
            chunk_id = doc.metadata.get("chunk_id", str(rank))
            fused_scores[chunk_id] = fused_scores.get(chunk_id, 0) + 1 / (rrf_k + rank + 1)

        for rank, (chunk_id, bm25_score) in enumerate(sorted(
            bm25_scores.items(), key=lambda x: x[1], reverse=True
        )):
            fused_scores[chunk_id] = fused_scores.get(chunk_id, 0) + 1 / (rrf_k + rank + 1)

        reranked = sorted(
            vector_results,
            key=lambda d: fused_scores.get(d.metadata.get("chunk_id", ""), 0),
            reverse=True
        )

        return reranked[:k]
```

- [ ] **Step 3: 提交**

```bash
git add service/src/vector_store.py service/src/rag_search.py
git commit -m "feat(service): add vector store and RAG search"
```

---

### Task 5: API 路由和 FastAPI 主入口

**Files:**
- Create: `service/src/main.py`
- Create: `service/src/routes/__init__.py`
- Create: `service/src/routes/chat.py`
- Create: `service/src/routes/index.py`
- Create: `service/src/routes/search.py`

- [ ] **Step 1: 创建 main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes import chat, index, search
from src.config import settings

app = FastAPI(
    title="Zotero AI Reader Service",
    description="AI-powered PDF reader service for Zotero",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(index.router, prefix="/api", tags=["index"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(search.router, prefix="/api", tags=["search"])


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
```

- [ ] **Step 2: 创建 routes/__init__.py**

```python
from . import chat, index, search

__all__ = ["chat", "index", "search"]
```

- [ ] **Step 3: 创建 routes/chat.py**

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.llm import llm_manager
from src.config import settings

router = APIRouter()


class ChatRequest(BaseModel):
    item_id: int
    question: str
    use_rag: bool = True
    provider: str | None = None
    model: str | None = None


class Citation(BaseModel):
    index: int
    chapter_title: str
    chapter_index: int
    page_num: int | None
    quoted_text: str
    reasoning: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]


# 全局存储，实际应该用数据库
_item_store = {}


def set_item_store(item_id: int, data: dict):
    _item_store[item_id] = data


def get_item_store(item_id: int) -> dict | None:
    return _item_store.get(item_id)


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    item_data = get_item_store(req.item_id)
    if not item_data:
        raise HTTPException(404, "文献未建立索引")

    rag = item_data.get("rag")
    if req.use_rag and rag:
        results = rag.hybrid_search(req.question, k=5)
        context_parts = []
        citations = []
        for i, r in enumerate(results, 1):
            context_parts.append(f"[{i}] {r.page_content[:300]}...")
            citations.append(Citation(
                index=i,
                chapter_title=r.metadata.get("chapter_title", "未知"),
                chapter_index=r.metadata.get("chapter_index", 0),
                page_num=r.metadata.get("start_page"),
                quoted_text=r.page_content[:100],
                reasoning=f"相关度: {r.metadata.get('score', 0):.2f}",
            ))
        context = "\n\n".join(context_parts)
    else:
        context = ""
        citations = []

    system_prompt = f"""你是一个AI阅读助手，基于参考材料回答用户问题。
{f"参考材料:\n{context}" if context else ""}

回答要求：
1. 基于参考材料回答，使用【N】标注来源
2. 回答要准确、简洁
3. 如果参考材料不足，说明无法回答
"""

    answer = await llm_manager.chat(
        messages=[{"role": "user", "content": req.question}],
        provider=req.provider,
        model=req.model,
        system_prompt=system_prompt,
    )

    return ChatResponse(answer=answer, citations=citations)
```

- [ ] **Step 4: 创建 routes/index.py**

```python
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from src.pdf_processor import extract_pdf
from src.chunker import SemanticChunker
from src.vector_store import VectorStore
from src.rag_search import RAGSearch
from src.routes.chat import set_item_store

router = APIRouter()


class IndexRequest(BaseModel):
    item_id: int
    pdf_path: str
    force_reindex: bool = False


def do_index(item_id: int, pdf_path: str):
    documents, metadata = extract_pdf(pdf_path)
    chunker = SemanticChunker(chunk_size=500, chunk_overlap=50)
    chunks = chunker.chunk_documents(documents)

    texts = [c.page_content for c in chunks]
    metadatas = [c.metadata for c in chunks]

    vector_store = VectorStore()
    # 注意：这里需要 embeddings，实际应该调用 embedding 服务
    # 简化版本先用 placeholder
    import numpy as np
    dim = 384  # MiniLM dimension
    embeddings = np.random.randn(len(texts), dim).tolist()

    vector_store.add_documents(chunks, embeddings)

    rag = RAGSearch(vector_store)
    rag.index_for_bm25(texts)

    set_item_store(item_id, {
        "metadata": metadata,
        "rag": rag,
        "texts": texts,
        "metadatas": metadatas,
    })


@router.post("/index")
async def index_pdf(req: IndexRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(do_index, req.item_id, req.pdf_path)
    return {"status": "indexing", "message": "正在建立索引"}
```

- [ ] **Step 5: 创建 routes/search.py**

```python
from fastapi import APIRouter, Query
from pydantic import BaseModel

from src.routes.chat import get_item_store

router = APIRouter()


class SearchResult(BaseModel):
    content: str
    item_id: int
    chapter_title: str
    score: float


class SearchResponse(BaseModel):
    results: list[SearchResult]


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., description="搜索查询"),
    item_id: int = Query(None, description="指定文献ID，为空则搜索所有"),
    limit: int = Query(10, ge=1, le=50),
):
    if item_id is not None:
        item_data = get_item_store(item_id)
        if not item_data:
            return SearchResponse(results=[])

        rag = item_data.get("rag")
        if not rag:
            return SearchResponse(results=[])

        # 简化：纯 BM25 搜索
        results = rag.hybrid_search(q, k=limit)
        return SearchResponse(results=[
            SearchResult(
                content=r.page_content[:200],
                item_id=item_id,
                chapter_title=r.metadata.get("chapter_title", ""),
                score=r.metadata.get("score", 0),
            )
            for r in results
        ])

    return SearchResponse(results=[])
```

- [ ] **Step 6: 提交**

```bash
git add service/src/main.py service/src/routes/
git commit -m "feat(service): add FastAPI routes and main entry"
```

---

## 第二阶段：Zotero 插件

### Task 6: 插件框架初始化

**Files:**
- Create: `plugin/package.json`
- Create: `plugin/tsconfig.json`
- Create: `plugin/zotero-plugin.config.ts`
- Create: `plugin/addon/manifest.json`
- Create: `plugin/addon/bootstrap.js`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "zotero-ai-reader",
  "version": "1.0.0",
  "description": "AI-powered PDF reader for Zotero",
  "author": "Your Name",
  "license": "MIT",
  "type": "module",
  "scripts": {
    "start": "zotero-plugin serve",
    "build": "zotero-plugin build",
    "release": "zotero-plugin release"
  },
  "dependencies": {},
  "devDependencies": {
    "zotero-plugin": "latest",
    "zotero-types": "latest",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 创建 manifest.json**

```json
{
  "manifest_version": 2,
  "name": "zotero-ai-reader",
  "version": "1.0.0",
  "description": "AI-powered PDF reader for Zotero",
  "author": "Your Name",
  "icons": {
    "48": "content/icons/favicon@0.5x.png",
    "96": "content/icons/favicon.png"
  },
  "applications": {
    "zotero": {
      "id": "zotero-ai-reader@yourname",
      "strict_min_version": "6.999",
      "strict_max_version": "8.*"
    }
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add plugin/
git commit -m "feat(plugin): initial plugin framework"
```

---

### Task 7: 插件核心代码

**Files:**
- Create: `plugin/src/index.ts`
- Create: `plugin/src/hooks.ts`
- Create: `plugin/src/addon.ts`
- Create: `plugin/src/utils/config.ts`
- Create: `plugin/src/modules/api-client.ts`

- [ ] **Step 1: 创建 index.ts**

```typescript
import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

const basicTool = new BasicTool();

if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  _globalThis.addon = new Addon();
  defineGlobal("ztoolkit", () => _globalThis.addon.data.ztoolkit);
  Zotero[config.addonInstance] = addon;
}
```

- [ ] **Step 2: 创建 addon.ts**

```typescript
class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    env: "development" | "production";
    ztoolkit: any;
  };

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      ztoolkit: createZToolkit(),
    };
  }
}

export default Addon;
```

- [ ] **Step 3: 创建 api-client.ts**

```typescript
const API_BASE = "http://127.0.0.1:8765/api";

export interface ChatRequest {
  item_id: number;
  question: string;
  use_rag: boolean;
  provider?: string;
  model?: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

export interface Citation {
  index: number;
  chapter_title: string;
  chapter_index: number;
  page_num: number | null;
  quoted_text: string;
  reasoning: string;
}

export interface IndexResponse {
  status: string;
  message: string;
}

export class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async indexItem(itemId: number, pdfPath: string): Promise<IndexResponse> {
    const response = await fetch(`${this.baseUrl}/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, pdf_path: pdfPath }),
    });
    return response.json();
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return response.json();
  }

  async health(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/../health`);
    return response.json();
  }
}

export const apiClient = new APIClient();
```

- [ ] **Step 4: 创建 hooks.ts**

```typescript
import { apiClient } from "./modules/api-client";

export default {
  onStartUp() {
    // 插件启动
  },

  onShutDown() {
    // 插件关闭
  },

  async onMainWindowLoad(window: Window) {
    // 注册菜单
    this.registerMenus();
  },

  registerMenus() {
    const menuString = `
      <menupopup id="zotero-item-menu">
        <menuitem id="zotero-ai-reader-chat"
                  label="AI 问答"
                  oncommand="addon.hooks.onAIChat()"/>
        <menuitem id="zotero-ai-reader-summarize"
                  label="总结文献"
                  oncommand="addon.hooks.onSummarize()"/>
        <menuitem id="zotero-ai-reader-search"
                  label="语义搜索"
                  oncommand="addon.hooks.onSearch()"/>
      </menupopup>
    `;
    // 实际注册逻辑使用 zotero-toolkit
  },

  async onAIChat() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) return;

    const item = items[0];
    const attachment = item.getAttachment?.();
    if (!attachment) return;

    const pdfPath = await attachment.getFilePath?.();
    if (!pdfPath) return;

    // 索引
    await apiClient.indexItem(item.id, pdfPath);

    // 打开问答面板
    const question = await this.showPrompt("AI 问答", "请输入您的问题:");
    if (!question) return;

    const response = await apiClient.chat({
      item_id: item.id,
      question,
      use_rag: true,
    });

    this.showAnswer(response);
  },

  async onSummarize() {
    // 实现总结功能
  },

  async onSearch() {
    // 实现语义搜索
  },

  async showPrompt(title: string, message: string): Promise<string | null> {
    // 显示输入对话框
    return new Promise((resolve) => {
      const result = window.prompt(message, "");
      resolve(result);
    });
  },

  showAnswer(response: any) {
    // 显示回答
    const msg = response.answer + "\n\n参考来源:\n" +
      response.citations.map((c: any) => `[${c.index}] ${c.chapter_title}: ${c.quoted_text}`).join("\n");
    window.alert(msg);
  },
};
```

- [ ] **Step 5: 提交**

```bash
git add plugin/src/
git commit -m "feat(plugin): add core plugin code"
```

---

## 第三阶段：测试和集成

### Task 8: 服务启动和测试

- [ ] **Step 1: 安装依赖并启动服务**

```bash
cd service
pip install -r requirements.txt
python -m uvicorn src.main:app --host 127.0.0.1 --port 8765
```

- [ ] **Step 2: 测试健康检查**

```bash
curl http://127.0.0.1:8765/health
# 期望: {"status":"ok"}
```

- [ ] **Step 3: 测试索引功能**

```bash
curl -X POST http://127.0.0.1:8765/api/index \
  -H "Content-Type: application/json" \
  -d '{"item_id": 1, "pdf_path": "/path/to/test.pdf"}'
```

---

## 实施完成检查清单

- [ ] Python 后端服务运行正常
- [ ] API 接口测试通过
- [ ] Zotero 插件框架编译通过
- [ ] 菜单项正确注册
- [ ] AI 问答功能可用
- [ ] 语义搜索功能可用
- [ ] 总结功能可用
