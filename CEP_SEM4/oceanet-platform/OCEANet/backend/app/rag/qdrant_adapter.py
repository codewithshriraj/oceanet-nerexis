from __future__ import annotations

import importlib
import os
import uuid
from typing import Any

from app.rag.embeddings import embed_text

QDRANT_ENABLED = os.getenv("OCEANET_QDRANT_ENABLED", "0").strip().lower() in {"1", "true", "yes"}
COLLECTION_NAME = "nerexis_documents"
VECTOR_SIZE = 128


def is_enabled() -> bool:
    return QDRANT_ENABLED


def get_qdrant_config() -> dict[str, str]:
    return {
        "host": os.getenv("OCEANET_QDRANT_HOST", "localhost"),
        "port": os.getenv("OCEANET_QDRANT_PORT", "6333"),
        "api_key": os.getenv("OCEANET_QDRANT_API_KEY", ""),
        "collection": COLLECTION_NAME,
    }


def _import_qdrant() -> Any:
    try:
        return importlib.import_module("qdrant_client")
    except Exception as exc:
        raise RuntimeError(
            "qdrant-client is not installed. Install 'qdrant-client' to enable RAG integration."
        ) from exc


def _create_client() -> Any:
    qdrant_client = _import_qdrant()
    config = get_qdrant_config()
    return qdrant_client.QdrantClient(
        host=config["host"],
        port=int(config["port"]),
        api_key=config["api_key"] or None,
        prefer_grpc=False,
    )


def _ensure_collection(client: Any) -> None:
    try:
        client.get_collection(collection_name=COLLECTION_NAME)
    except Exception:
        qdrant_http = importlib.import_module("qdrant_client.http")
        models = qdrant_http.models
        client.recreate_collection(
            collection_name=COLLECTION_NAME,
            vectors=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE),
            wait=True,
        )


def _normalize_metadata(metadata: dict[str, Any]) -> dict[str, str]:
    return {str(k): str(v) for k, v in (metadata or {}).items()}


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    words = str(text or "").split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(len(words), start + chunk_size)
        chunk = " ".join(words[start:end]).strip()
        if chunk:
            chunks.append(chunk)
        if end == len(words):
            break
        start += chunk_size - overlap
    return chunks or [text.strip()]


def index_document(document: dict[str, Any]) -> dict[str, Any]:
    if not is_enabled():
        return {
            "enabled": False,
            "status": "disabled",
            "message": "Qdrant is disabled. Set OCEANET_QDRANT_ENABLED=1 to enable vector indexing.",
        }

    client = _create_client()
    _ensure_collection(client)

    source = str(document.get("source") or "unknown")
    text = str(document.get("text") or document.get("content") or "").strip()
    metadata = _normalize_metadata(document.get("metadata") or {})
    document_id = str(document.get("id") or uuid.uuid4())

    chunks = _chunk_text(text)
    points = []
    for idx, chunk in enumerate(chunks):
        vector = embed_text(chunk)
        point_id = f"{document_id}-{idx}"
        points.append(
            {
                "id": point_id,
                "vector": vector,
                "payload": {
                    "document_id": document_id,
                    "source": source,
                    "chunk_text": chunk[:512],
                    **metadata,
                },
            }
        )

    if points:
        client.upsert(collection_name=COLLECTION_NAME, points=points, wait=True)

    return {
        "enabled": True,
        "status": "indexed",
        "document_id": document_id,
        "source": source,
        "chunk_count": len(points),
        "collection": COLLECTION_NAME,
        "message": "Document ingested into Qdrant collection.",
    }


def search_vectors(query: str, top_k: int = 5, metadata_filter: dict[str, Any] | None = None) -> dict[str, Any]:
    if not is_enabled():
        return {
            "enabled": False,
            "query": query,
            "results": [],
            "message": "Qdrant is disabled. Set OCEANET_QDRANT_ENABLED=1 to enable search.",
        }

    client = _create_client()
    vector = embed_text(query)
    search_kwargs: dict[str, Any] = {
        "collection_name": COLLECTION_NAME,
        "query_vector": vector,
        "limit": int(top_k),
    }

    if metadata_filter:
        qdrant_http = importlib.import_module("qdrant_client.http")
        models = qdrant_http.models
        must = [models.FieldCondition(key=str(k), match=models.MatchValue(value=str(v))) for k, v in metadata_filter.items()]
        search_kwargs["query_filter"] = models.Filter(must=must)

    results = client.search(**search_kwargs)
    hits = []
    for item in results:
        hits.append(
            {
                "id": str(item.id),
                "score": float(item.score or 0.0),
                "payload": dict(item.payload or {}),
            }
        )

    return {
        "enabled": True,
        "query": query,
        "top_k": int(top_k),
        "results": hits,
        "collection": COLLECTION_NAME,
    }
