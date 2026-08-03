"""Retrieval-augmented generation package for scientific research workflows."""

from .qdrant_adapter import is_enabled, index_document, search_vectors
from .embeddings import embed_text
from .ingest import ingest_document
