from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.validators.datie import evaluate_dataset, summarize

DATA_ROOT = os.getenv("OCEANET_DATA_ROOT", os.path.join(os.path.dirname(__file__), "..", "..", "data"))
DB_PATH = os.getenv("OCEANET_DB_PATH", os.path.join(DATA_ROOT, "oceanet_auth.db"))


def _create_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=2)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout = 2000")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def _persist_event(event: dict[str, Any]) -> None:
    try:
        with _create_connection() as conn:
            conn.execute(
                "INSERT INTO anomaly_events (dataset_id, event_type, severity, detected_at, metadata) VALUES (?, ?, ?, ?, ?)",
                (
                    event.get("dataset_id"),
                    event.get("event_type"),
                    event.get("severity"),
                    event.get("detected_at"),
                    str(event.get("metadata") or {}),
                ),
            )
            conn.commit()
    except Exception:
        pass


def detect_events(dataset_id: int | None = None, limit: int = 10) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    events: list[dict[str, Any]] = []

    if dataset_id is not None:
        result = evaluate_dataset(dataset_id)
        severity = "Low"
        if result.final_authenticity_score < 50 or result.duplicate_probability_score >= 80:
            severity = "High"
        elif result.final_authenticity_score < 65 or result.freshness_score < 45:
            severity = "Medium"

        event = {
            "dataset_id": dataset_id,
            "event_type": "dataset_integrity_anomaly",
            "severity": severity,
            "summary": f"Detected {severity} anomaly in dataset {dataset_id}.",
            "details": {
                "final_authenticity_score": result.final_authenticity_score,
                "duplicate_probability_score": result.duplicate_probability_score,
                "freshness_score": result.freshness_score,
                "trust_band": result.score_band,
            },
            "detected_at": now,
            "metadata": {
                "source": result.source,
                "region": result.region,
            },
        }
        _persist_event(event)
        events.append(event)
    else:
        summary = summarize()
        events.append(
            {
                "event_type": "summarized_integrity_scan",
                "severity": "Informational",
                "summary": "Completed platform-level dataset integrity scan.",
                "detected_at": now,
                "metadata": {
                    "total_datasets": summary.get("total_datasets"),
                    "average_authenticity_score": summary.get("average_authenticity_score"),
                    "band_counts": summary.get("band_counts"),
                },
            }
        )

    return {
        "events": events,
        "generated_at": now,
        "debug": {"dataset_id": dataset_id, "limit": limit},
    }
