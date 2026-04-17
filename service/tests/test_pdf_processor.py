import pytest
from pathlib import Path
from src.pdf_processor import PDFProcessor, extract_pdf
from src.chunker import SemanticChunker


def test_pdf_processor():
    pass  # TODO: 添加实际测试


def test_chunker():
    from langchain_core.documents import Document
    chunker = SemanticChunker(chunk_size=100, chunk_overlap=20)
    docs = [Document(page_content="这是测试内容" * 50, metadata={"chapter_index": 0})]
    chunks = chunker.chunk_documents(docs)
    assert len(chunks) > 0
    assert chunks[0].metadata["chunk_id"] is not None
