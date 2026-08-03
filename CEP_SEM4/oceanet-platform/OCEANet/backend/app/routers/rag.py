from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException

from app.rag.embeddings import embed_text
from app.rag.ingest import ingest_document
from app.rag.qdrant_adapter import get_qdrant_config, index_document, is_enabled, search_vectors

router = APIRouter(prefix="/api/v1/rag", tags=["rag"])


@router.get("/status")
def status() -> dict[str, object]:
    return {
        "enabled": is_enabled(),
        "config": get_qdrant_config(),
        "message": "RAG service is available as an optional integration.",
    }


@router.post("/ingest")
async def rag_ingest(payload: dict[str, object] = Body(...)) -> dict[str, object]:
    source = str(payload.get("source") or "").strip()
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    content = str(payload.get("content") or "").strip()
    if not source or not content:
        raise HTTPException(status_code=400, detail="source and content are required")
    return ingest_document(source, metadata, content)


@router.post("/search")
async def rag_search(payload: dict[str, str] = Body(...)) -> dict[str, object]:
    query_text = payload.get("query", "").strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="query text is required")
    return search_vectors(query_text)


@router.post("/embed")
async def rag_embed(payload: dict[str, str] = Body(...)) -> dict[str, object]:
    text = payload.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    return embed_text(text)
