from __future__ import annotations

import base64
import importlib
import io
import os
import re
import uuid
from datetime import datetime
from typing import Any

from app.rag.qdrant_adapter import index_document, is_enabled

PDF_MAGIC_HEADER = b"%PDF"


def _extract_pdf_text(pdf_base64: str) -> str:
    try:
        pdf_data = base64.b64decode(pdf_base64)
        if not pdf_data.startswith(PDF_MAGIC_HEADER):
            return str(pdf_base64)
        PyPDF2 = importlib.import_module("PyPDF2")
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_data))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages).strip()
    except Exception:
        return str(pdf_base64)


def _chunk_text(text: str, max_words: int = 250, overlap: int = 50) -> list[str]:
    words = str(text or "").split()
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(len(words), start + max_words)
        chunk = " ".join(words[start:end]).strip()
        if chunk:
            chunks.append(chunk)
        if end == len(words):
            break
        start += max_words - overlap
    return chunks or [text.strip()]


def ingest_document(source: str, metadata: dict[str, Any], content: str) -> dict[str, Any]:
    if not is_enabled():
        return {
            "enabled": False,
            "source": source,
            "metadata": metadata,
            "message": "RAG ingestion is disabled. Set OCEANET_QDRANT_ENABLED=1 to enable it.",
        }

    content_type = str(metadata.get("content_type") or "text/plain").lower()
    document_id = str(metadata.get("document_id") or uuid.uuid4())
    raw_text = str(content or "")

    if content_type == "application/pdf" and raw_text:
        raw_text = _extract_pdf_text(raw_text)

    if not raw_text.strip():
        return {
            "enabled": False,
            "status": "failed",
            "message": "Ingested content is empty. Provide text or a PDF base64 payload.",
        }

    metadata = {**metadata, "document_id": document_id, "content_type": content_type, "ingested_at": os.getenv("OCEANET_INGESTED_AT", datetime.utcnow().isoformat())}
    document = {
        "id": document_id,
        "source": source,
        "metadata": metadata,
        "text": raw_text,
    }

    result = index_document(document)
    return {
        "enabled": result.get("enabled", True),
        "document_id": document_id,
        "source": source,
        "collection": result.get("collection"),
        "chunk_count": result.get("chunk_count"),
        "status": result.get("status"),
        "message": result.get("message"),
    }
