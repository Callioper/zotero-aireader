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
    vector_store.add_documents(texts, embeddings, metadatas)

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
