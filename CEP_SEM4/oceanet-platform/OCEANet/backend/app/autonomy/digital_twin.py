from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.validators.datie import evaluate_dataset


def simulate_scenario(payload: dict[str, Any]) -> dict[str, Any]:
    scenario = str(payload.get("scenario") or "ocean_warming").strip()
    duration_days = int(payload.get("duration_days") or 30)
    dataset_id = payload.get("dataset_id")
    baseline = float(payload.get("baseline_index") or 1.0)
    intensity = float(payload.get("intensity") or 1.2)

    if dataset_id is not None:
        try:
            dataset_id = int(dataset_id)
            evaluation = evaluate_dataset(dataset_id)
            baseline = baseline * (evaluation.final_authenticity_score / 100.0 + 0.5)
            intensity = intensity * (1.0 + max(0.0, (100 - evaluation.final_authenticity_score) / 100.0))
        except Exception:
            pass

    timeline: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    for day in range(duration_days):
        date = (now + timedelta(days=day)).strftime("%Y-%m-%d")
        score = round(baseline * (1 + intensity * day / max(duration_days, 1)), 2)
        timeline.append({"date": date, "scenario_score": score})

    return {
        "scenario": scenario,
        "duration_days": duration_days,
        "dataset_id": dataset_id,
        "baseline_index": baseline,
        "intensity": intensity,
        "timeline": timeline,
        "generated_at": now.isoformat(),
        "notes": [
            "Digital twin scenario simulation uses current dataset trust and intensity factors.",
            "Future upgrades can replace this model with hydrodynamic and ecosystem simulations.",
        ],
    }
