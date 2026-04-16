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
        self.avg_doc_len = sum(self.doc_lens) / len(self.doc_texts) if self.doc_texts else 0
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
