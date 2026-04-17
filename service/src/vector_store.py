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

    def add_documents(self, texts: list[str], embeddings: list[list[float]], metadatas: list[dict]) -> None:
        if len(texts) != len(embeddings):
            raise ValueError(f"Number of texts ({len(texts)}) must match number of embeddings ({len(embeddings)})")
        if len(texts) != len(metadatas):
            raise ValueError(f"Number of texts ({len(texts)}) must match number of metadatas ({len(metadatas)})")

        self.texts = texts
        self.metadatas = metadatas

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
                metadata={**metadata, "score": float(score), "result_index": idx}
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
