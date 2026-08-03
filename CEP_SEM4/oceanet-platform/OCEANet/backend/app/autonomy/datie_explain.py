from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.validators.datie import evaluate_dataset, evaluate_report


def _confidence_from_score(score: int) -> int:
    if score >= 90:
        return 98
    if score >= 75:
        return 92
    if score >= 60:
        return 85
    if score >= 45:
        return 72
    return 60


def get_trust_score_breakdown(entity_type: str, entity_id: int) -> dict[str, Any]:
    if entity_type not in {"dataset", "report"}:
        raise ValueError("Unsupported entity_type. Use 'dataset' or 'report'.")

    if entity_type == "dataset":
        result = evaluate_dataset(entity_id)
    else:
        result = evaluate_report(entity_id)

    breakdown = []
    for factor, contributions in result.feature_importance.items():
        if not isinstance(contributions, list):
            continue
        total = sum(item.get("delta", 0) for item in contributions if isinstance(item, dict))
        breakdown.append(
            {
                "factor": factor,
                "score": getattr(result, f"{factor}_score", None) if hasattr(result, f"{factor}_score") else None,
                "contributions": contributions,
                "summary": f"{len(contributions)} evidence items contributed to {factor}.",
                "estimated_impact": round(total, 2),
            }
        )

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "title": result.title,
        "region": result.region,
        "source": result.source,
        "final_authenticity_score": result.final_authenticity_score,
        "confidence_score": _confidence_from_score(result.final_authenticity_score),
        "trust_score_band": result.score_band,
        "breakdown": breakdown,
        "explanations": result.explanations,
        "formulas": result.formulas,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
