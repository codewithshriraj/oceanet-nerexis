from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException

from app.graph.neo4j_adapter import get_neo4j_config, is_enabled, query_graph, sync_graph

router = APIRouter(prefix="/api/v1/graph", tags=["graph"])


@router.get("/status")
def status() -> dict[str, object]:
    return {
        "enabled": is_enabled(),
        "config": get_neo4j_config(),
        "message": "Knowledge graph service is available as an optional integration.",
    }


@router.post("/query")
async def graph_query(payload: dict[str, str] = Body(...)) -> dict[str, object]:
    query_text = payload.get("query", "").strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="query text is required")
    return query_graph(query_text)


@router.post("/sync")
async def graph_sync() -> dict[str, object]:
    return sync_graph()
