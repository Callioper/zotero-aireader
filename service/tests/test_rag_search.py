import pytest
import numpy as np
from langchain_core.documents import Document

from src.vector_store import VectorStore
from src.rag_search import BM25, RAGSearch


class TestBM25:
    def test_tokenize(self):
        bm25 = BM25()
        tokens = bm25._tokenize("Hello World! This is a test.")
        assert tokens == ["hello", "world", "this", "is", "a", "test"]

    def test_index_and_search(self):
        documents = [
            "The cat sat on the mat",
            "The dog ran in the park",
            "Cats and dogs are pets",
        ]
        bm25 = BM25()
        bm25.index(documents)

        scores = bm25.get_scores("cat")
        assert len(scores) == 3
        assert scores[0] > scores[1]

        top_k = bm25.get_top_k("cat", k=2)
        assert len(top_k) == 2
        assert top_k[0][0] == 0

    def test_empty_query(self):
        bm25 = BM25()
        bm25.index(["document one", "document two"])
        scores = bm25.get_scores("")
        assert all(s == 0 for s in scores)


class TestVectorStore:
    def test_add_and_search(self, tmp_path):
        store = VectorStore(store_path=tmp_path / "test_store")
        texts = ["content one", "content two"]
        metadatas = [{"chunk_id": "1"}, {"chunk_id": "2"}]
        embeddings = [[1.0, 0.0], [0.0, 1.0]]
        store.add_documents(texts, embeddings, metadatas)

        results = store.search([0.5, 0.5], k=1)
        assert len(results) == 1
        assert results[0].metadata["chunk_id"] in ["1", "2"]

    def test_exists(self, tmp_path):
        store = VectorStore(store_path=tmp_path / "new_store")
        assert not store.exists()

        store.add_documents(["test"], [[1.0, 0.0]], [{"chunk_id": "1"}])
        assert store.exists()


class TestRAGSearch:
    def test_bm25_only_search(self, tmp_path):
        store = VectorStore(store_path=tmp_path / "test_store")
        texts = ["apple fruit is sweet", "banana fruit is yellow", "carrot vegetable is orange"]
        metadatas = [{"chunk_id": "1"}, {"chunk_id": "2"}, {"chunk_id": "3"}]
        embeddings = [[1.0, 0.0], [0.0, 1.0], [0.5, 0.5]]
        store.add_documents(texts, embeddings, metadatas)

        rag = RAGSearch(store)
        rag.index_for_bm25(texts)

        results = rag.hybrid_search("fruit")
        assert len(results) >= 1
        assert any("fruit" in r.page_content for r in results)

    def test_hybrid_search(self, tmp_path):
        store = VectorStore(store_path=tmp_path / "test_store")
        texts = ["python programming language", "java programming language", "python snake animal"]
        metadatas = [{"chunk_id": "1"}, {"chunk_id": "2"}, {"chunk_id": "3"}]
        embeddings = [[1.0, 0.0], [0.0, 1.0], [0.8, 0.2]]
        store.add_documents(texts, embeddings, metadatas)

        rag = RAGSearch(store)
        rag.index_for_bm25(texts)

        query_embedding = [0.9, 0.1]
        results = rag.hybrid_search("python", query_embedding=query_embedding, k=2)
        assert len(results) <= 2

    def test_no_bm25_index(self, tmp_path):
        store = VectorStore(store_path=tmp_path / "test_store")
        store.add_documents(["test content"], [[1.0, 0.0]], [{"chunk_id": "1"}])

        rag = RAGSearch(store)
        results = rag.hybrid_search("test", query_embedding=[1.0, 0.0])
        assert len(results) >= 1
