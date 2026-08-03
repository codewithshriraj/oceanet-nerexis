from __future__ import annotations

import importlib
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from app.autonomy.datie_explain import get_trust_score_breakdown
from app.autonomy.event_detection import detect_events
from app.autonomy.forecast_intelligence import forecast_dataset
from app.autonomy.kg_adapter import is_enabled as kg_enabled, query_kg
from app.autonomy.memory import get_agent_memory, save_agent_memory
from app.autonomy.research_copilot import answer_query
from app.autonomy.scientific_report import generate_scientific_report
from app.tasks.worker import execute_background_task

DATA_ROOT = os.getenv("OCEANET_DATA_ROOT", os.path.join(os.path.dirname(__file__), "..", "..", "data"))
DB_PATH = os.getenv("OCEANET_DB_PATH", os.path.join(DATA_ROOT, "oceanet_auth.db"))


def _create_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout = 2000")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def _ensure_task_table() -> None:
    try:
        with _create_connection() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS agent_tasks ("
                "task_id TEXT PRIMARY KEY, "
                "agent_name TEXT, "
                "input_payload TEXT, "
                "output_payload TEXT, "
                "status TEXT, "
                "created_at TEXT, "
                "completed_at TEXT"
                ")"
            )
            conn.commit()
    except Exception:
        pass


def _serialize_payload(payload: Any) -> str:
    try:
        return json.dumps(payload, default=str, ensure_ascii=False)
    except Exception:
        return str(payload)


def _deserialize_payload(value: str | None) -> Any:
    if not value:
        return {}
    try:
        return json.loads(value)
    except Exception:
        return value


def _persist_agent_task(task: dict[str, Any]) -> dict[str, Any]:
    if task.get("task_id") is None:
        task["task_id"] = str(uuid.uuid4())
    task_id = task["task_id"]
    now = datetime.now(timezone.utc).isoformat()
    task.setdefault("created_at", now)
    task["completed_at"] = task.get("completed_at")

    _ensure_task_table()
    try:
        with _create_connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO agent_tasks (task_id, agent_name, input_payload, output_payload, status, created_at, completed_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    task_id,
                    task.get("agent_name"),
                    _serialize_payload(task.get("input_payload") or {}),
                    _serialize_payload(task.get("output_payload") or {}),
                    task.get("status", "queued"),
                    task.get("created_at"),
                    task.get("completed_at"),
                ),
            )
            conn.commit()
    except Exception:
        pass
    return task


def load_agent_task(task_id: str) -> dict[str, Any] | None:
    try:
        _ensure_task_table()
        with _create_connection() as conn:
            row = conn.execute(
                "SELECT * FROM agent_tasks WHERE task_id = ?",
                (task_id,),
            ).fetchone()
            if not row:
                return None
            task = dict(row)
            task["input_payload"] = _deserialize_payload(task.get("input_payload"))
            task["output_payload"] = _deserialize_payload(task.get("output_payload"))
            return task
    except Exception:
        return None


def _load_rag_client() -> Any | None:
    try:
        module = importlib.import_module("app.rag.qdrant_adapter")
        return module
    except Exception:
        return None


def _run_data_validation(payload: dict[str, Any]) -> dict[str, Any]:
    entity_type = "dataset" if payload.get("dataset_id") is not None else "report"
    entity_id = int(payload.get("dataset_id") or payload.get("report_id") or 0)
    if entity_id <= 0:
        raise ValueError("dataset_id or report_id is required for data validation")
    result = get_trust_score_breakdown(entity_type, entity_id)
    return {
        "agent": "Data Validation Agent",
        "entity_type": entity_type,
        "entity_id": entity_id,
        "result": result,
    }


def _run_research_agent(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or payload.get("topic") or "").strip()
    dataset_id = payload.get("dataset_id")
    context = payload.get("context") or {}

    research = answer_query(payload)
    if kg_enabled() and query:
        research["knowledge_graph"] = query_kg(query)

    rag = None
    rag_module = _load_rag_client()
    if rag_module and query:
        try:
            rag = rag_module.search_vectors(query, top_k=int(payload.get("top_k", 5)))
        except Exception as exc:
            rag = {"error": str(exc)}

    return {
        "agent": "Research Agent",
        "query": query,
        "dataset_id": dataset_id,
        "research": research,
        "rag": rag,
        "context": context,
    }


def _run_forecast_agent(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_id = int(payload.get("dataset_id") or 0)
    horizon = int(payload.get("horizon", 7))
    forecast_type = str(payload.get("forecast_type", "environment"))
    if dataset_id <= 0:
        raise ValueError("dataset_id is required for forecast agent")
    result = forecast_dataset(dataset_id, horizon=horizon, forecast_type=forecast_type)
    return {
        "agent": "Forecast Agent",
        "dataset_id": dataset_id,
        "forecast_type": forecast_type,
        "result": result,
    }


def _run_biodiversity_agent(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_id = payload.get("dataset_id")
    if dataset_id is None:
        raise ValueError("dataset_id is required for biodiversity agent")
    dataset_id = int(dataset_id)
    events = detect_events(dataset_id=dataset_id)
    research = answer_query({"query": f"biodiversity implications of dataset {dataset_id}", "dataset_id": dataset_id})
    return {
        "agent": "Biodiversity Agent",
        "dataset_id": dataset_id,
        "events": events,
        "research": research,
    }


def _run_risk_assessment_agent(payload: dict[str, Any]) -> dict[str, Any]:
    dataset_id = int(payload.get("dataset_id") or 0)
    if dataset_id <= 0:
        raise ValueError("dataset_id is required for risk assessment agent")
    trust = get_trust_score_breakdown("dataset", dataset_id)
    forecast = forecast_dataset(dataset_id, horizon=int(payload.get("horizon", 14)))
    events = detect_events(dataset_id=dataset_id)
    risk_score = int(
        max(0, min(100, 0.4 * trust["final_authenticity_score"] + 0.35 * forecast.get("confidence", 60) + 0.25 * (100 if any(e.get("severity") == "High" for e in events.get("events", [])) else 70)))
    )
    return {
        "agent": "Risk Assessment Agent",
        "dataset_id": dataset_id,
        "trust": trust,
        "forecast": forecast,
        "events": events,
        "risk_score": risk_score,
        "risk_band": "Elevated" if risk_score < 50 else "Moderate" if risk_score < 75 else "Low",
    }


def _run_scientific_report_agent(payload: dict[str, Any]) -> dict[str, Any]:
    report = generate_scientific_report(payload)
    return {
        "agent": "Scientific Report Agent",
        "report": report,
    }


def _run_agent_logic(agent_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    normalized = agent_name.strip().lower()
    if normalized in {"data_validation", "validation", "data-validation"}:
        return _run_data_validation(payload)
    if normalized in {"research", "research_agent"}:
        return _run_research_agent(payload)
    if normalized in {"forecast", "forecasting", "forecast_agent"}:
        return _run_forecast_agent(payload)
    if normalized in {"biodiversity", "biodiversity_agent"}:
        return _run_biodiversity_agent(payload)
    if normalized in {"risk_assessment", "risk_agent"}:
        return _run_risk_assessment_agent(payload)
    if normalized in {"report", "report_agent", "scientific_report"}:
        return _run_scientific_report_agent(payload)
    return {
        "agent": "Unknown Agent",
        "message": f"No specialized agent exists for '{agent_name}'.",
    }


def run_agent(agent_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    agent_name = agent_name.strip().lower()
    task_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc).isoformat()
    memory_snapshot = get_agent_memory(agent_name)
    task = {
        "task_id": task_id,
        "agent_name": agent_name,
        "input_payload": payload,
        "output_payload": {},
        "status": "queued",
        "created_at": started_at,
        "completed_at": None,
        "memory_snapshot": memory_snapshot,
    }
    _persist_agent_task(task)

    background = bool(payload.get("background"))
    try:
        if background:
            queue_result = execute_background_task(agent_name, payload)
            task["status"] = "queued"
            task["output_payload"] = {"queued": True, "queue_result": queue_result}
            _persist_agent_task(task)
            return task

        output = _run_agent_logic(agent_name, payload)
        task["output_payload"] = output
        task["status"] = "completed"
        task["completed_at"] = datetime.now(timezone.utc).isoformat()
        save_agent_memory(agent_name, {"last_run": output, "payload": payload, "updated_at": task["completed_at"]})
    except Exception as exc:
        task["output_payload"] = {"error": str(exc)}
        task["status"] = "failed"
        task["completed_at"] = datetime.now(timezone.utc).isoformat()

    _persist_agent_task(task)
    return task
