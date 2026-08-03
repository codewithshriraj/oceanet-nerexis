from __future__ import annotations

import importlib
import os
import re
from datetime import datetime
from typing import Any

from app.validators.datie import _fetch_all
from .schema import GRAPH_ENTITY_TYPES, GRAPH_RELATION_TYPES

KG_ENABLED = os.getenv("OCEANET_KG_ENABLED", "0").strip().lower() in {"1", "true", "yes"}
COLLECTION_NAME = "nerexis_graph"

OCEAN_REGION_KEYWORDS = [
    "north atlantic",
    "bay of bengal",
    "pacific basin",
    "mediterranean",
    "caribbean",
    "south china sea",
    "arabian sea",
    "southern ocean",
    "coral triangle",
    "gulf of mexico",
    "black sea",
    "baltic sea",
    "north sea",
    "sea of japan",
    "tasman sea",
    "bering sea",
    "weddell sea",
    "red sea",
    "south pacific",
]
SPECIES_KEYWORDS = [
    "shark",
    "dolphin",
    "whale",
    "turtle",
    "coral",
    "krill",
    "salmon",
    "tuna",
    "seabird",
    "manta",
    "stingray",
    "octopus",
]
POLLUTANT_KEYWORDS = [
    "co2",
    "methane",
    "plastic",
    "microplastic",
    "oil spill",
    "mercury",
    "nitrogen",
    "phosphorus",
    "pesticide",
    "heavy metal",
]
CLIMATE_EVENT_KEYWORDS = [
    "hurricane",
    "heatwave",
    "storm",
    "flood",
    "drought",
    "sea level rise",
    "coral bleaching",
    "wildfire",
    "cyclone",
]


def is_enabled() -> bool:
    return KG_ENABLED


def get_neo4j_config() -> dict[str, str]:
    return {
        "uri": os.getenv("OCEANET_KG_URI", "bolt://localhost:7687"),
        "user": os.getenv("OCEANET_KG_USER", "neo4j"),
        "password": os.getenv("OCEANET_KG_PASS", "password"),
    }


def _import_neo4j() -> Any:
    try:
        neo4j = importlib.import_module("neo4j")
        return neo4j.GraphDatabase
    except Exception as exc:
        raise RuntimeError(
            "Neo4j driver is not installed. Install 'neo4j' to enable KG integration."
        ) from exc


def _create_driver():
    driver_class = _import_neo4j()
    config = get_neo4j_config()
    return driver_class.driver(
        config["uri"],
        auth=(config["user"], config["password"]),
    )


def _infer_names(text: str, keywords: list[str]) -> list[str]:
    text_lower = text.lower()
    matches = []
    for value in keywords:
        if value in text_lower:
            matches.append(value.title())
    return matches


def _normalize_text(text: Any) -> str:
    if text is None:
        return ""
    return str(text).strip()


def _run_cypher(query: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    if not is_enabled():
        raise RuntimeError("Knowledge graph is disabled.")
    driver = _create_driver()
    with driver.session() as session:
        result = session.run(query, params or {})
        return [dict(record.data()) for record in result]


def sync_graph() -> dict[str, Any]:
    if not is_enabled():
        return {
            "enabled": False,
            "message": "Knowledge graph is disabled. Set OCEANET_KG_ENABLED=1 to activate Neo4j sync.",
        }

    datasets = _fetch_all("SELECT * FROM datasets ORDER BY created_at DESC", None)
    reports = _fetch_all("SELECT * FROM reports ORDER BY created_at DESC", None)
    node_counts = {entity: 0 for entity in GRAPH_ENTITY_TYPES}
    rel_counts = {rel: 0 for rel in GRAPH_RELATION_TYPES}

    with _create_driver().session() as session:
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (d:Dataset) REQUIRE d.id IS UNIQUE")
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (p:ResearchPaper) REQUIRE p.id IS UNIQUE")
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (r:OceanRegion) REQUIRE r.name IS UNIQUE")
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (s:Species) REQUIRE s.name IS UNIQUE")
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (p:Pollutant) REQUIRE p.name IS UNIQUE")
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (c:ClimateEvent) REQUIRE c.name IS UNIQUE")

        for row in datasets:
            dataset_id = _normalize_text(row.get("id"))
            name = _normalize_text(row.get("original_name")) or f"Dataset {dataset_id}"
            dataset_type = _normalize_text(row.get("dataset_type") or "Unknown")
            source = _normalize_text(row.get("source") or "unknown")
            created_at = _normalize_text(row.get("created_at") or datetime.utcnow().isoformat())
            is_verified = bool(row.get("is_verified"))
            file_path = _normalize_text(row.get("file_path") or "")

            session.run(
                "MERGE (d:Dataset {id: $id}) "
                "SET d.name = $name, d.dataset_type = $dataset_type, d.source = $source, "
                "d.created_at = $created_at, d.is_verified = $is_verified, d.file_path = $file_path",
                {
                    "id": dataset_id,
                    "name": name,
                    "dataset_type": dataset_type,
                    "source": source,
                    "created_at": created_at,
                    "is_verified": is_verified,
                    "file_path": file_path,
                },
            )
            node_counts["Dataset"] += 1

            region_names = _infer_names(dataset_type + " " + name, OCEAN_REGION_KEYWORDS)
            for region_name in region_names:
                session.run(
                    "MERGE (r:OceanRegion {name: $name})",
                    {"name": region_name},
                )
                session.run(
                    "MATCH (d:Dataset {id: $dataset_id}), (r:OceanRegion {name: $name}) "
                    "MERGE (d)-[:MEASURES]->(r)",
                    {"dataset_id": dataset_id, "name": region_name},
                )
                rel_counts["measures"] += 1

            for species in _infer_names(name, SPECIES_KEYWORDS):
                session.run(
                    "MERGE (s:Species {name: $name})",
                    {"name": species},
                )
                session.run(
                    "MATCH (d:Dataset {id: $dataset_id}), (s:Species {name: $name}) "
                    "MERGE (d)-[:CONTAINS]->(s)",
                    {"dataset_id": dataset_id, "name": species},
                )
                rel_counts["contains"] += 1

            for pollutant in _infer_names(name, POLLUTANT_KEYWORDS):
                session.run(
                    "MERGE (p:Pollutant {name: $name})",
                    {"name": pollutant},
                )
                session.run(
                    "MATCH (d:Dataset {id: $dataset_id}), (p:Pollutant {name: $name}) "
                    "MERGE (d)-[:MEASURES]->(p)",
                    {"dataset_id": dataset_id, "name": pollutant},
                )
                rel_counts["measures"] += 1

            for event_name in _infer_names(name, CLIMATE_EVENT_KEYWORDS):
                session.run(
                    "MERGE (c:ClimateEvent {name: $name})",
                    {"name": event_name},
                )
                session.run(
                    "MATCH (d:Dataset {id: $dataset_id}), (c:ClimateEvent {name: $name}) "
                    "MERGE (d)-[:IMPACTS]->(c)",
                    {"dataset_id": dataset_id, "name": event_name},
                )
                rel_counts["impacts"] += 1

        for row in reports:
            report_id = _normalize_text(row.get("id"))
            title = _normalize_text(row.get("title") or "Research Paper")
            region = _normalize_text(row.get("region") or "Global")
            report_type = _normalize_text(row.get("report_type") or "Report")
            created_at = _normalize_text(row.get("created_at") or datetime.utcnow().isoformat())

            session.run(
                "MERGE (p:ResearchPaper {id: $id}) "
                "SET p.title = $title, p.report_type = $report_type, p.region = $region, p.created_at = $created_at",
                {
                    "id": report_id,
                    "title": title,
                    "report_type": report_type,
                    "region": region,
                    "created_at": created_at,
                },
            )
            node_counts["ResearchPaper"] += 1

            region_names = _infer_names(region + " " + title, OCEAN_REGION_KEYWORDS)
            for region_name in region_names:
                session.run(
                    "MERGE (r:OceanRegion {name: $name})",
                    {"name": region_name},
                )
                session.run(
                    "MATCH (p:ResearchPaper {id: $report_id}), (r:OceanRegion {name: $name}) "
                    "MERGE (p)-[:ADDRESSES]->(r)",
                    {"report_id": report_id, "name": region_name},
                )
                rel_counts["references"] += 1

            for event_name in _infer_names(title + " " + _normalize_text(row.get("content")), CLIMATE_EVENT_KEYWORDS):
                session.run(
                    "MERGE (c:ClimateEvent {name: $name})",
                    {"name": event_name},
                )
                session.run(
                    "MATCH (p:ResearchPaper {id: $report_id}), (c:ClimateEvent {name: $name}) "
                    "MERGE (p)-[:CITES]->(c)",
                    {"report_id": report_id, "name": event_name},
                )
                rel_counts["cites"] += 1

    return {
        "enabled": True,
        "status": "synced",
        "dataset_count": len(datasets),
        "report_count": len(reports),
        "node_counts": node_counts,
        "relationship_counts": rel_counts,
        "message": "Knowledge graph sync completed using Neo4j optional integration.",
    }


def query_graph(query_text: str) -> dict[str, Any]:
    if not is_enabled():
        return {
            "enabled": False,
            "query": query_text,
            "results": [],
            "message": "Knowledge graph is disabled. Set OCEANET_KG_ENABLED=1 to enable Neo4j queries.",
        }

    normalized = query_text.strip()
    query = normalized
    if not normalized.upper().startswith(("MATCH ", "RETURN ", "WITH ", "CALL ", "OPTIONAL ")):
        query = _translate_to_cypher(normalized)

    try:
        records = _run_cypher(query)
        return {
            "enabled": True,
            "query": query_text,
            "cypher": query,
            "result": records,
            "message": "Query executed successfully.",
        }
    except Exception as exc:
        return {
            "enabled": True,
            "query": query_text,
            "cypher": query,
            "result": [],
            "error": str(exc),
        }


def _translate_to_cypher(text: str) -> str:
    text_lower = text.lower()
    if "species" in text_lower and "region" in text_lower:
        return (
            "MATCH (s:Species)-[:CONTAINS|LIVES_IN|MEASURES]->(r:OceanRegion) "
            "RETURN s.name AS species, r.name AS region LIMIT 50"
        )
    if "pollutant" in text_lower:
        return (
            "MATCH (d:Dataset)-[:MEASURES]->(p:Pollutant) "
            "RETURN d.name AS dataset, p.name AS pollutant LIMIT 50"
        )
    if "climate" in text_lower or "event" in text_lower:
        return (
            "MATCH (c:ClimateEvent)<-[:IMPACTS|CITES]-(n) "
            "RETURN c.name AS event, labels(n) AS source, n.name AS source_name LIMIT 50"
        )
    if "paper" in text_lower or "research" in text_lower:
        return (
            "MATCH (p:ResearchPaper) "
            "RETURN p.title AS title, p.region AS region, p.report_type AS type LIMIT 50"
        )
    return "MATCH (n) RETURN labels(n) AS labels, n AS node LIMIT 50"
