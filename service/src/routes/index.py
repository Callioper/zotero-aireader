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
    import numpy as np
    dim = 384
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