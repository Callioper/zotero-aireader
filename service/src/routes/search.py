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