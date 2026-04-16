from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes import chat, index, search
from src.config import settings

app = FastAPI(
    title="Zotero AI Reader Service",
    description="AI-powered PDF reader service for Zotero",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(index.router, prefix="/api", tags=["index"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(search.router, prefix="/api", tags=["search"])


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)