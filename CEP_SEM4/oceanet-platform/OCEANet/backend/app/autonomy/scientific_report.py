from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services.report_ai import local_report_ai_lines
from app.validators.datie import evaluate_dataset, summarize


def generate_scientific_report(payload: dict[str, Any]) -> dict[str, Any]:
    title = str(payload.get("title") or "Environmental Intelligence Report").strip()
    region = str(payload.get("region") or "Global").strip()
    dataset_id = payload.get("dataset_id")
    context = payload.get("context") or {}

    if isinstance(dataset_id, int):
        dataset = evaluate_dataset(dataset_id).to_dict()
        score = dataset.get("final_authenticity_score", 50)
        trust_band = dataset.get("score_band", "Moderate Authenticity")
        evidence = dataset.get("explanations", [])
    else:
        summary = summarize()
        score = summary.get("average_authenticity_score", 50)
        trust_band = "Moderate Authenticity"
        evidence = ["Platform-level dataset integrity summary is available."]

    narrative = local_report_ai_lines(
        region=region,
        report_type=str(payload.get("report_type") or "Environmental Forecast"),
        context={
            "risk_band": trust_band,
            "risk_score": int(score),
            "regional_report_count": int(context.get("regional_report_count") or 0),
            "dataset_count": int(context.get("dataset_count") or 0),
            "top_sources": context.get("top_sources") or [],
        },
    )

    return {
        "title": title,
        "region": region,
        "dataset_id": dataset_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "score": int(score),
        "trust_band": trust_band,
        "abstract": f"This report summarizes environmental intelligence for {region} with a trust score of {score}.",
        "findings": evidence,
        "discussion": [
            "The intelligence pipeline blends dataset authenticity, anomaly detection, and forecasting.",
            "Use the trust score breakdown before operationalizing recommendations.",
        ],
        "recommendations": narrative,
        "metadata": {
            "source": "Nerexis Autonomous Report Agent",
            "context": context,
        },
    }
