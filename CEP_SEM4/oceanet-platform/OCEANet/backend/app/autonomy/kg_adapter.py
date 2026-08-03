from __future__ import annotations

from typing import Any

from app.graph.neo4j_adapter import is_enabled as neo4j_enabled, query_graph


def is_enabled() -> bool:
    return neo4j_enabled()


def query_kg(query_text: str) -> dict[str, Any]:
    if not is_enabled():
        return {
            "enabled": False,
            "message": "Knowledge graph layer is disabled. Set OCEANET_KG_ENABLED=1 to enable optional Neo4j integration.",
        }

    return query_graph(query_text)
