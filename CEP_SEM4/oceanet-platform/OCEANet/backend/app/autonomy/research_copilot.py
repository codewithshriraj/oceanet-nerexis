from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from app.validators.datie import evaluate_dataset, summarize
from app.services.report_ai import local_report_ai_lines


def _normalize_query(query: Any) -> str:
    return str(query or "").strip()


def _load_dataset_summary(dataset_id: int) -> dict[str, Any]:
    try:
        dataset = evaluate_dataset(dataset_id).to_dict()
        return {
            "dataset_id": dataset_id,
            "title": dataset["title"],
            "final_authenticity_score": dataset["final_authenticity_score"],
            "trust_band": dataset["score_band"],
            "source": dataset["source"],
            "summary": dataset["explanations"],
        }
    except Exception:
        return {"dataset_id": dataset_id, "error": "Dataset could not be evaluated."}


def answer_query(payload: dict[str, Any]) -> dict[str, Any]:
    query = _normalize_query(payload.get("query"))
    dataset_id = payload.get("dataset_id")
    topic = _normalize_query(payload.get("topic"))
    context = payload.get("context", {}) if isinstance(payload.get("context"), dict) else {}

    if not query:
        return {
            "query": query,
            "error": "Query text is required.",
        }

    dataset_context = None
    if isinstance(dataset_id, int):
        dataset_context = _load_dataset_summary(dataset_id)

    dataset_count = int(context.get("dataset_count") or 0)
    if dataset_context is None:
        global_summary = summarize()
        dataset_count = dataset_count or int(global_summary.get("total_datasets", 0))
        dataset_context = {
            "total_datasets": dataset_count,
            "average_authenticity_score": global_summary.get("average_authenticity_score"),
            "band_counts": global_summary.get("band_counts"),
        }

    recommendation = []
    if dataset_context.get("final_authenticity_score", 100) < 60:
        recommendation.append("Review provenance and validation fields for stale or duplicate datasets.")
    if dataset_context.get("final_authenticity_score", 100) < 40:
        recommendation.append("Escalate the dataset to expert review before decision-making.")
    if dataset_context.get("trust_band") == "High Authenticity":
        recommendation.append("Consider this dataset for upstream modeling and synthetic analysis.")

    llm_context = {
        "dataset_context": dataset_context,
        "topic": topic or "environmental intelligence",
        "query": query,
    }
    narrative_lines = local_report_ai_lines(
        region=dataset_context.get("region", "Global"),
        report_type=topic or "environmental analysis",
        context={
            "risk_band": dataset_context.get("trust_band", "Moderate"),
            "risk_score": int(dataset_context.get("final_authenticity_score", 72) or 72),
            "dataset_count": dataset_count,
            "regional_report_count": int(context.get("regional_report_count") or 0),
            "top_sources": context.get("top_sources") or [],
        },
    )

    return {
        "query": query,
        "topic": topic,
        "dataset_id": dataset_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_context": dataset_context,
        "recommendations": recommendation,
        "answer": " ".join(narrative_lines),
        "narrative_lines": narrative_lines,
        "citation_hints": [
            "Use source provenance",
            "Validate against duplicate risk",
            "Prioritize high-authenticity data for research insights",
        ],
        "raw_context": llm_context,
    }
