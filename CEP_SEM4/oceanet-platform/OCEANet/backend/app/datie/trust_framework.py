from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.validators.datie import evaluate_dataset, evaluate_report


def _extract_score(result: Any) -> int:
    if isinstance(result, dict):
        return int(result.get("final_authenticity_score", 0))
    return int(getattr(result, "final_authenticity_score", 0))


def _build_interval(score: int) -> list[int]:
    margin = max(5, min(15, int(100 - score) // 10 + 5))
    lower = max(0, score - margin)
    upper = min(100, score + margin)
    return [lower, upper]


def compute_trust_score(inputs: dict[str, Any]) -> dict[str, Any]:
    entity_type = str(inputs.get("entity_type") or inputs.get("type") or "dataset").strip().lower()
    entity_id = int(inputs.get("entity_id") or inputs.get("dataset_id") or inputs.get("report_id") or 0)
    if entity_type not in {"dataset", "report"}:
        raise ValueError("entity_type must be 'dataset' or 'report'.")
    if entity_id <= 0:
        raise ValueError("entity_id, dataset_id, or report_id is required.")

    if entity_type == "dataset":
        result = evaluate_dataset(entity_id)
    else:
        result = evaluate_report(entity_id)

    score = _extract_score(result)
    interval = _build_interval(score)
    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "trust_score": score,
        "confidence_interval": interval,
        "summary": f"Computed DATIE trust score for {entity_type} {entity_id}.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
