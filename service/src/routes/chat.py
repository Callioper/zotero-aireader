import threading
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.llm import llm_manager
from src.config import settings

router = APIRouter()

_item_store = {}
_item_lock = threading.Lock()


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


def set_item_store(item_id: int, data: dict):
    with _item_lock:
        _item_store[item_id] = data


def get_item_store(item_id: int) -> dict | None:
    with _item_lock:
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

    ref_material = f"Reference Material:\n{context}" if context else ""
    system_prompt = f"""You are an AI reading assistant. Answer user questions based on the reference material.
{ref_material}

Answer Requirements:
1. Answer based on reference material, use 【N】 to indicate sources
2. Be accurate and concise
3. If reference material is insufficient, say you cannot answer
"""

    try:
        answer = await llm_manager.chat(
            messages=[{"role": "user", "content": req.question}],
            provider=req.provider,
            model=req.model,
            system_prompt=system_prompt,
        )
    except Exception as e:
        raise HTTPException(500, f"LLM error: {str(e)}")

    return ChatResponse(answer=answer, citations=citations)
