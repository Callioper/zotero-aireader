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
