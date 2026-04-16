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
        raise HTTPException(404, "文献未建立索引")

    rag = item_data.get("rag")
    if req.use_rag and rag:
        results = rag.hybrid_search(req.question, k=5)
        context_parts = []
        citations = []
        for i, r in enumerate(results, 1):
            context_parts.append(f"[{i}] {r.page_content[:300]}...")
            citations.append(Citation(
                index=i,
                chapter_title=r.metadata.get("chapter_title", "未知"),
                chapter_index=r.metadata.get("chapter_index", 0),
                page_num=r.metadata.get("start_page"),
                quoted_text=r.page_content[:100],
                reasoning=f"相关度: {r.metadata.get('score', 0):.2f}",
            ))
        context = "\n\n".join(context_parts)
    else:
        context = ""
        citations = []

    system_prompt = """你是一个AI阅读助手，基于参考材料回答用户问题。
""" + (f"参考材料:\n{context}" if context else "") + """

回答要求：
1. 基于参考材料回答，使用【N】标注来源
2. 回答要准确、简洁
3. 如果参考材料不足，说明无法回答
"""

    answer = await llm_manager.chat(
        messages=[{"role": "user", "content": req.question}],
        provider=req.provider,
        model=req.model,
        system_prompt=system_prompt,
    )

    return ChatResponse(answer=answer, citations=citations)