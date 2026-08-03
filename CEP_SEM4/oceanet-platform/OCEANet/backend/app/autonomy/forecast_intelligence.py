from __future__ import annotations

import csv
import math
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.validators.datie import _fetch_one, evaluate_dataset

DATA_ROOT = os.getenv("OCEANET_DATA_ROOT", os.path.join(os.path.dirname(__file__), "..", "..", "data"))
DATASET_STORAGE_DIR = os.path.abspath(os.path.join(DATA_ROOT, "datasets"))


def _get_dataset_path(stored_name: str) -> Path:
    return Path(DATASET_STORAGE_DIR) / stored_name


def _parse_numeric_series(file_path: Path, max_rows: int = 120) -> list[float]:
    if not file_path.exists() or file_path.suffix.lower() != ".csv":
        return []

    values: list[float] = []
    with file_path.open("r", encoding="utf-8", errors="ignore") as stream:
        reader = csv.reader(stream)
        headers = next(reader, None)
        for idx, row in enumerate(reader):
            if idx >= max_rows:
                break
            if len(row) < 2:
                continue
            try:
                value = float(row[1].strip())
            except Exception:
                continue
            values.append(value)
    return values


def _linear_forecast(series: list[float], horizon: int) -> list[float]:
    if not series:
        return [0.0] * horizon
    x_mean = sum(range(len(series))) / len(series)
    y_mean = sum(series) / len(series)
    numerator = sum((i - x_mean) * (value - y_mean) for i, value in enumerate(series))
    denominator = sum((i - x_mean) ** 2 for i in range(len(series))) or 1.0
    slope = numerator / denominator
    intercept = y_mean - slope * x_mean
    return [round(max(0.0, intercept + slope * (len(series) + i)), 2) for i in range(horizon)]


def _risk_band(score: int) -> str:
    if score >= 85:
        return "Low"
    if score >= 65:
        return "Moderate"
    return "Elevated"


def forecast_dataset(dataset_id: int, horizon: int = 7, forecast_type: str = "environment") -> dict[str, Any]:
    dataset = evaluate_dataset(dataset_id)
    row = _fetch_one("SELECT * FROM datasets WHERE id = ?", (dataset_id,))
    stored_name = row.get("stored_name") if row else None
    forecast_results: list[dict[str, Any]] = []
    values: list[float] = []

    if stored_name:
        path = _get_dataset_path(stored_name)
        values = _parse_numeric_series(path)

    if values:
        projection = _linear_forecast(values, horizon)
    else:
        baseline = dataset["final_authenticity_score"] / 100.0
        projection = [round(50.0 + baseline * 20 + i * 1.2, 2) for i in range(horizon)]

    today = datetime.now(timezone.utc)
    for offset, value in enumerate(projection):
        forecast_results.append(
            {
                "date": (today + timedelta(days=offset + 1)).strftime("%Y-%m-%d"),
                "forecast_value": value,
            }
        )

    slope = projection[-1] - projection[0] if projection else 0
    trend = "increasing" if slope > 1 else "decreasing" if slope < -1 else "flat"

    return {
        "dataset_id": dataset_id,
        "forecast_type": forecast_type,
        "horizon_days": horizon,
        "trend": trend,
        "risk_band": _risk_band(dataset["final_authenticity_score"]),
        "confidence": 80 if dataset["final_authenticity_score"] >= 70 else 60,
        "forecast": forecast_results,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
