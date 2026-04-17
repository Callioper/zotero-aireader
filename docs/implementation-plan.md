# Zotero AI Reader Implementation Plan

> **For agentic workers:** Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Develop a Zotero plugin with AI-powered PDF reading capabilities (Q&A, summarization, semantic search, note enhancement) using a separate Python backend service.

**Architecture:** Plugin + Local Service Separation. The Zotero plugin communicates with a Python FastAPI service via HTTP. The backend handles PDF parsing, vectorization, and LLM calls.

**Tech Stack:**
- Zotero Plugin: TypeScript + Zotero Plugin Toolkit
- Python Service: FastAPI + LangChain + FAISS
- Vector Storage: FAISS + SQLite
- AI Services: Ollama/LM Studio (local) + DeepSeek/OpenAI/Claude API

---

## File Structure

```
ai-reader-zotero-plugin/
├── service/                      # Python backend service
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI entry
│   │   ├── config.py             # Configuration
│   │   ├── pdf_processor.py      # PDF parsing
│   │   ├── chunker.py           # Text chunking
│   │   ├── vector_store.py       # FAISS vector storage
│   │   ├── rag_search.py         # RAG search (BM25 + vector)
│   │   ├── llm.py               # LLM wrapper
│   │   └── routes/              # API routes
│   │       ├── __init__.py
│   │       ├── chat.py          # Q&A endpoint
│   │       ├── index.py          # Indexing endpoint
│   │       └── search.py         # Search endpoint
│   ├── tests/                   # Tests
│   ├── requirements.txt
│   └── .env.example
│
├── plugin/                      # Zotero plugin (already initialized)
│   ├── addon/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── api-client.ts    # Backend API client
│   │   │   ├── ai-chat.ts       # Q&A UI
│   │   │   ├── search.ts        # Semantic search UI
│   │   │   └── summarize.ts     # Summarization UI
│   │   └── utils/
│   └── package.json
│
└── docs/
    └── implementation-plan.md
```

---

## Phase 1: Python Backend Service

### Task 1: Project Initialization and Configuration

**Files:**
- Create: `service/requirements.txt`
- Create: `service/.env.example`
- Create: `service/src/__init__.py`
- Create: `service/src/config.py`

- [ ] **Step 1: Create service directory structure**

```bash
mkdir -p service/src/routes service/tests
```

- [ ] **Step 2: Create requirements.txt**

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
sentence-transformers==3.0.1
```

- [ ] **Step 3: Create .env.example**

```env
# LLM Service Configuration (supports Ollama/LM Studio/OpenAI/DeepSeek/Claude)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_API_KEY=ollama
LMSTUDIO_BASE_URL=http://localhost:1234
LMSTUDIO_API_KEY=lm-studio
DEEPSEEK_API_KEY=sk-xxxx
OPENAI_API_KEY=sk-xxxx
ANTHROPIC_API_KEY=sk-xxxx

# Default LLM Provider: ollama | lmstudio | deepseek | openai | claude
DEFAULT_LLM_PROVIDER=ollama
DEFAULT_LLM_MODEL=llama3.2

# Embedding Configuration
EMBEDDING_PROVIDER=local
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Service Configuration
HOST=127.0.0.1
PORT=8765
```

- [ ] **Step 4: Create config.py**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    ollama_base_url: str = "http://localhost:11434"
    ollama_api_key: str = "ollama"
    lmstudio_base_url: str = "http://localhost:1234"
    lmstudio_api_key: str = "lm-studio"
    deepseek_api_key: str = ""
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


settings = Settings()
settings.vector_store_path.mkdir(parents=True, exist_ok=True)
```

- [ ] **Step 5: Create __init__.py and commit**

```bash
touch service/src/__init__.py
touch service/src/routes/__init__.py
git add service/
git commit -m "feat(service): initial project structure"
```

---

### Task 2: PDF Processing and Text Chunking

**Files:**
- Create: `service/src/pdf_processor.py`
- Create: `service/src/chunker.py`

- [ ] **Step 1: Create pdf_processor.py**

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
            title = item[1].strip() if len(item) > 1 else f"Chapter {i+1}"
            page_num = item[2] - 1 if len(item) > 2 else 0
            chapters.append({"level": level, "title": title, "page": page_num})
        return chapters

    def extract_chapters(self) -> list[dict]:
        if self.doc is None:
            self.extract_metadata()

        toc = self.extract_toc()
        if not toc:
            return [{"title": "Full Text", "start_page": 0, "end_page": len(self.doc) - 1, "text": ""}]

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
                "chapter_title": chapter.get("title", f"Chapter {i+1}"),
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

- [ ] **Step 2: Create chunker.py**

```python
import re
from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter


class ChineseTextSplitter(RecursiveCharacterTextSplitter):
    def __init__(self, separators: list[str] | None = None, **kwargs):
        if separators is None:
            separators = ["\n\n", "\n", ". ", "。", "！", "？", "；", "，", "、", " "]
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

- [ ] **Step 3: Commit**

```bash
git add service/src/pdf_processor.py service/src/chunker.py
git commit -m "feat(service): add PDF processor and chunker"
```

---

### Task 3: LLM Wrapper

**Files:**
- Create: `service/src/llm.py`

- [ ] **Step 1: Create llm.py**

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

- [ ] **Step 2: Commit**

```bash
git add service/src/llm.py
git commit -m "feat(service): add LLM manager supporting multiple providers"
```

---

### Task 4: Vector Storage and RAG Search

**Files:**
- Create: `service/src/vector_store.py`
- Create: `service/src/rag_search.py`

- [ ] **Step 1: Create vector_store.py**

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

- [ ] **Step 2: Create rag_search.py**

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
            vector_results = self.vector_store.search(query_embedding, k=k * 2)
            return self._rrf_fusion(vector_results, bm25_scores, k, rrf_k)
        elif self._bm25_indexed:
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

- [ ] **Step 3: Commit**

```bash
git add service/src/vector_store.py service/src/rag_search.py
git commit -m "feat(service): add vector store and RAG search"
```

---

### Task 5: API Routes and FastAPI Main Entry

**Files:**
- Create: `service/src/main.py`
- Create: `service/src/routes/__init__.py`
- Create: `service/src/routes/chat.py`
- Create: `service/src/routes/index.py`
- Create: `service/src/routes/search.py`

- [ ] **Step 1: Create main.py**

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

- [ ] **Step 2: Create routes/__init__.py**

```python
from . import chat, index, search

__all__ = ["chat", "index", "search"]
```

- [ ] **Step 3: Create routes/chat.py**

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


_item_store = {}


def set_item_store(item_id: int, data: dict):
    _item_store[item_id] = data


def get_item_store(item_id: int) -> dict | None:
    return _item_store.get(item_id)


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    item_data = get_item_store(req.item_id)
    if not item_data:
        raise HTTPException(404, "Document not indexed")

    rag = item_data.get("rag")
    if req.use_rag and rag:
        results = rag.hybrid_search(req.question, k=5)
        context_parts = []
        citations = []
        for i, r in enumerate(results, 1):
            context_parts.append(f"[{i}] {r.page_content[:300]}...")
            citations.append(Citation(
                index=i,
                chapter_title=r.metadata.get("chapter_title", "Unknown"),
                chapter_index=r.metadata.get("chapter_index", 0),
                page_num=r.metadata.get("start_page"),
                quoted_text=r.page_content[:100],
                reasoning=f"Relevance: {r.metadata.get('score', 0):.2f}",
            ))
        context = "\n\n".join(context_parts)
    else:
        context = ""
        citations = []

    system_prompt = f"""You are an AI reading assistant. Answer user questions based on the reference material.
{f"Reference Material:\n{context}" if context else ""}

Answer Requirements:
1. Answer based on reference material, use 【N】 to indicate sources
2. Be accurate and concise
3. If reference material is insufficient, say you cannot answer
"""

    answer = await llm_manager.chat(
        messages=[{"role": "user", "content": req.question}],
        provider=req.provider,
        model=req.model,
        system_prompt=system_prompt,
    )

    return ChatResponse(answer=answer, citations=citations)
```

- [ ] **Step 4: Create routes/index.py**

```python
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
import numpy as np
from sentence_transformers import SentenceTransformer

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


def generate_embeddings(texts: list[str], model_name: str = "all-MiniLM-L6-v2") -> list[list[float]]:
    model = SentenceTransformer(model_name)
    embeddings = model.encode(texts, show_progress_bar=True)
    return embeddings.tolist()


def do_index(item_id: int, pdf_path: str):
    documents, metadata = extract_pdf(pdf_path)
    chunker = SemanticChunker(chunk_size=500, chunk_overlap=50)
    chunks = chunker.chunk_documents(documents)

    texts = [c.page_content for c in chunks]
    metadatas = [c.metadata for c in chunks]

    embeddings = generate_embeddings(texts)

    vector_store = VectorStore()
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
    return {"status": "indexing", "message": "Building index"}
```

- [ ] **Step 5: Create routes/search.py**

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
    q: str = Query(..., description="Search query"),
    item_id: int = Query(None, description="Specify item ID"),
    limit: int = Query(10, ge=1, le=50),
):
    if item_id is not None:
        item_data = get_item_store(item_id)
        if not item_data:
            return SearchResponse(results=[])

        rag = item_data.get("rag")
        if not rag:
            return SearchResponse(results=[])

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

- [ ] **Step 6: Commit**

```bash
git add service/src/main.py service/src/routes/
git commit -m "feat(service): add FastAPI routes and main entry"
```

---

## Phase 2: Zotero Plugin Core

### Task 6: API Client Module

**Files:**
- Create: `plugin/src/modules/api-client.ts`

- [ ] **Step 1: Create api-client.ts**

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

export interface SearchResult {
  content: string;
  item_id: number;
  chapter_title: string;
  score: number;
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

  async search(q: string, itemId?: number, limit?: number): Promise<{ results: SearchResult[] }> {
    const params = new URLSearchParams({ q });
    if (itemId !== undefined) params.append("item_id", String(itemId));
    if (limit !== undefined) params.append("limit", String(limit));

    const response = await fetch(`${this.baseUrl}/search?${params}`);
    return response.json();
  }

  async health(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/../health`);
    return response.json();
  }
}

export const apiClient = new APIClient();
```

- [ ] **Step 2: Commit**

```bash
git add plugin/src/modules/api-client.ts
git commit -m "feat(plugin): add API client module"
```

---

### Task 7: AI Chat UI Module

**Files:**
- Create: `plugin/src/modules/ai-chat.ts`

- [ ] **Step 1: Create ai-chat.ts**

```typescript
import { apiClient, ChatResponse } from "./api-client";

export class AIChatPanel {
  private panel: any;
  private itemId: number | null = null;
  private pdfPath: string | null = null;

  constructor() {
    this.panel = this.createPanel();
  }

  private createPanel() {
    return ztoolkit.createElement(document, "vbox", {
      namespace: "xul",
      attributes: { flex: "1" },
      children: [
        {
          tag: "label",
          attributes: { value: "AI 问答", style: "font-weight: bold; font-size: 16px;" },
        },
        {
          tag: "vbox",
          attributes: { flex: "1", style: "overflow: auto;" },
          children: [],
          id: "chat-messages",
        },
        {
          tag: "hbox",
          attributes: { align: "center" },
          children: [
            {
              tag: "textbox",
              attributes: { flex: "1", placeholder: "输入您的问题..." },
              id: "chat-input",
              listeners: [
                {
                  type: "keypress",
                  listener: (e: KeyboardEvent) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      this.sendQuestion();
                    }
                  },
                },
              ],
            },
            {
              tag: "button",
              attributes: { label: "发送" },
              listeners: [
                {
                  type: "click",
                  listener: () => this.sendQuestion(),
                },
              ],
            },
          ],
        },
      ],
    });
  }

  async open(itemId: number, pdfPath: string) {
    this.itemId = itemId;
    this.pdfPath = pdfPath;

    const existingPanel = document.getElementById("zotero-air-chat-panel");
    if (existingPanel) {
      existingPanel.remove();
    }

    this.panel.id = "zotero-air-chat-panel";
    ztoolkit.append(document.body, this.panel);

    await this.indexDocument();
  }

  private async indexDocument() {
    if (!this.itemId || !this.pdfPath) return;

    try {
      const health = await apiClient.health();
      if (health.status !== "ok") {
        this.showMessage("Backend service is not running. Please start the service.", "error");
        return;
      }

      this.showMessage("正在建立索引...", "info");
      await apiClient.indexItem(this.itemId, this.pdfPath);
      this.showMessage("索引建立完成，可以开始提问了。", "success");
    } catch (error) {
      this.showMessage(`索引失败: ${error}`, "error");
    }
  }

  private async sendQuestion() {
    const input = document.getElementById("chat-input") as XUL.TextBox;
    if (!input || !input.value.trim()) return;

    const question = input.value.trim();
    input.value = "";

    this.showMessage(`问题: ${question}`, "user");

    if (!this.itemId) return;

    try {
      this.showMessage("思考中...", "info");
      const response = await apiClient.chat({
        item_id: this.itemId,
        question,
        use_rag: true,
      });

      this.displayResponse(response);
    } catch (error) {
      this.showMessage(`回答失败: ${error}`, "error");
    }
  }

  private displayResponse(response: ChatResponse) {
    const messagesContainer = document.getElementById("chat-messages");
    if (!messagesContainer) return;

    const answerBox = ztoolkit.createElement(document, "vbox", {
      attributes: { style: "margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px;" },
    });

    answerBox.appendChild(
      ztoolkit.createElement(document, "label", {
        attributes: {
          value: `AI 回答: ${response.answer}`,
          style: "color: #333;",
        },
      })
    );

    if (response.citations.length > 0) {
      const citationsLabel = ztoolkit.createElement(document, "label", {
        attributes: {
          value: "参考来源:",
          style: "font-weight: bold; margin-top: 5px;",
        },
      });
      answerBox.appendChild(citationsLabel);

      response.citations.forEach((c) => {
        const citationText = `【${c.index}】${c.chapter_title}: ${c.quoted_text}`;
        answerBox.appendChild(
          ztoolkit.createElement(document, "label", {
            attributes: {
              value: citationText,
              style: "font-size: 12px; color: #666; margin-left: 10px;",
            },
          })
        );
      });
    }

    messagesContainer.appendChild(answerBox);
  }

  private showMessage(text: string, type: "user" | "info" | "error" | "success") {
    const messagesContainer = document.getElementById("chat-messages");
    if (!messagesContainer) return;

    const colors: Record<string, string> = {
      user: "#0078d7",
      info: "#666",
      error: "#d32f2f",
      success: "#388e3c",
    };

    const msgLabel = ztoolkit.createElement(document, "label", {
      attributes: {
        value: text,
        style: `color: ${colors[type] || colors.info}; margin: 5px 0;`,
      },
    });

    messagesContainer.appendChild(msgLabel);
  }

  close() {
    const panel = document.getElementById("zotero-air-chat-panel");
    if (panel) {
      panel.remove();
    }
  }
}

export const aiChatPanel = new AIChatPanel();
```

- [ ] **Step 2: Commit**

```bash
git add plugin/src/modules/ai-chat.ts
git commit -m "feat(plugin): add AI chat UI module"
```

---

### Task 8: Update Hooks with Menu Actions

**Files:**
- Modify: `plugin/src/hooks.ts`

- [ ] **Step 1: Update hooks.ts with full implementation**

```typescript
import { config } from "../package.json";
import { getPref } from "./utils/prefs";
import { apiClient } from "./modules/api-client";
import { aiChatPanel } from "./modules/ai-chat";

const hooks = {
  onStartup() {
    ztoolkit.log("startup-begin");
    this.registerNotifier();
    this.registerPrefs();
    this.registerMenu();
    this.data.initialized = true;
  },

  onShutdown() {
    ztoolkit.log("startup-finish");
    this.data.initialized = false;
    aiChatPanel.close();
  },

  async onMainWindowLoad(window: Window) {
    // UI setup if needed
  },

  onMainWindowUnload(window: Window) {
    ztoolkit.unregisterAll();
  },

  onPrefsEvent(event: string, data: { window: Window }) {
    switch (event) {
      case "load":
        this.initPrefsPanel(data.window);
        break;
    }
  },

  registerNotifier() {
    Zotero.Notifier.registerObserver(
      {
        notify: (
          event: string,
          type: string,
          ids: Array<string | number>,
          extraData: { [key: string]: any },
        ) => {
          // Handle item changes if needed
        },
      },
      ["item"],
      "zotero-ai-reader",
    );
  },

  registerPrefs() {
    ztoolkit.PrefsPane.add({
      pluginID: config.addonID,
      src: rootURI + "content/preferences.xhtml",
      label: "AI Reader",
      iconURL: rootURI + "content/icons/favicon.png",
    });
  },

  registerMenu() {
    ztoolkit.Menu.register("item", {
      label: "AI Reader",
      icon: rootURI + "content/icons/favicon.png",
      children: [
        {
          label: "AI 问答",
          icon: rootURI + "content/icons/favicon.png",
          command: () => {
            this.onAIChat();
          },
        },
        {
          label: "总结文献",
          icon: rootURI + "content/icons/favicon.png",
          command: () => {
            this.onSummarize();
          },
        },
        {
          label: "语义搜索",
          icon: rootURI + "content/icons/favicon.png",
          command: () => {
            this.onSearch();
          },
        },
      ],
    });
  },

  initPrefsPanel(window: Window) {
    // Initialize preferences panel
  },

  async onAIChat() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) {
      ztoolkit.alert("请先选择一个文献条目");
      return;
    }

    const item = items[0];
    const attachment = item.getAttachment?.();
    if (!attachment) {
      ztoolkit.alert("请选择一个包含 PDF 附件的文献条目");
      return;
    }

    const pdfPath = await attachment.getFilePath?.();
    if (!pdfPath) {
      ztoolkit.alert("无法获取 PDF 文件路径");
      return;
    }

    aiChatPanel.open(item.id, pdfPath);
  },

  async onSummarize() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) {
      ztoolkit.alert("请先选择一个文献条目");
      return;
    }

    const item = items[0];
    const attachment = item.getAttachment?.();
    if (!attachment) {
      ztoolkit.alert("请选择一个包含 PDF 附件的文献条目");
      return;
    }

    const pdfPath = await attachment.getFilePath?.();
    if (!pdfPath) {
      ztoolkit.alert("无法获取 PDF 文件路径");
      return;
    }

    try {
      const health = await apiClient.health();
      if (health.status !== "ok") {
        ztoolkit.alert("后端服务未运行，请先启动服务");
        return;
      }

      ztoolkit.alert("正在生成总结，请稍候...");

      await apiClient.indexItem(item.id, pdfPath);
      const response = await apiClient.chat({
        item_id: item.id,
        question: "请总结这篇文献的主要内容，包括研究问题、方法、结果和结论。",
        use_rag: true,
      });

      ztoolkit.alert("文献总结:\n\n" + response.answer);
    } catch (error) {
      ztoolkit.alert(`总结失败: ${error}`);
    }
  },

  async onSearch() {
    const result = await ztoolkit.prompt("语义搜索", "输入搜索内容:");
    if (!result) return;

    try {
      const items = ZoteroPane.getSelectedItems();
      const itemId = items.length > 0 ? items[0].id : undefined;

      const response = await apiClient.search(result, itemId, 10);

      if (response.results.length === 0) {
        ztoolkit.alert("未找到相关结果");
        return;
      }

      let message = `找到 ${response.results.length} 个相关结果:\n\n`;
      response.results.forEach((r, i) => {
        message += `【${i + 1}】${r.chapter_title}\n${r.content}\n\n`;
      });

      ztoolkit.alert(message);
    } catch (error) {
      ztoolkit.alert(`搜索失败: ${error}`);
    }
  },
};

export default hooks;
```

- [ ] **Step 2: Commit**

```bash
git add plugin/src/hooks.ts
git commit -m "feat(plugin): update hooks with full menu actions"
```

---

## Phase 3: Testing and Integration

### Task 9: Backend Service Testing

- [ ] **Step 1: Install dependencies and test backend**

```bash
cd service
pip install -r requirements.txt
python -m uvicorn src.main:app --host 127.0.0.1 --port 8765
```

- [ ] **Step 2: Test health endpoint**

```bash
curl http://127.0.0.1:8765/health
# Expected: {"status":"ok"}
```

- [ ] **Step 3: Commit service completion**

```bash
git add -A
git commit -m "feat(service): complete backend service"
```

---

### Task 10: Plugin Build and Test

- [ ] **Step 1: Install plugin dependencies**

```bash
cd plugin
npm install
```

- [ ] **Step 2: Build plugin**

```bash
npm run build
```

- [ ] **Step 3: Test in Zotero**

```bash
npm start
```

- [ ] **Step 4: Commit plugin completion**

```bash
git add -A
git commit -m "feat(plugin): complete initial plugin implementation"
```

---

## Completion Checklist

- [ ] Backend service runs on port 8765
- [ ] Health endpoint returns ok
- [ ] PDF indexing works
- [ ] AI Q&A returns answers with citations
- [ ] Semantic search returns relevant results
- [ ] Plugin builds successfully
- [ ] Menu items register correctly in Zotero
- [ ] All 4 features (Q&A, Summarize, Search, Notes) are accessible
