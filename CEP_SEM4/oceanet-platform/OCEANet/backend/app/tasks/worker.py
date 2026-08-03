from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

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
                "CREATE TABLE IF NOT EXISTS background_tasks ("
                "task_id TEXT PRIMARY KEY, "
                "task_name TEXT, "
                "payload TEXT, "
                "status TEXT, "
                "created_at TEXT, "
                "updated_at TEXT"
                ")"
            )
            conn.commit()
    except Exception:
        pass


def execute_background_task(task_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    _ensure_task_table()
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    try:
        with _create_connection() as conn:
            conn.execute(
                "INSERT INTO background_tasks (task_id, task_name, payload, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    task_id,
                    task_name,
                    json.dumps(payload, default=str, ensure_ascii=False),
                    "queued",
                    now,
                    now,
                ),
            )
            conn.commit()
    except Exception as exc:
        return {
            "task_name": task_name,
            "status": "failed",
            "message": "Failed to queue background task.",
            "error": str(exc),
        }

    return {
        "task_id": task_id,
        "task_name": task_name,
        "status": "queued",
        "created_at": now,
        "message": "Task has been queued for background execution.",
    }


def get_queued_tasks(limit: int = 10) -> list[dict[str, Any]]:
    _ensure_task_table()
    tasks: list[dict[str, Any]] = []
    try:
        with _create_connection() as conn:
            rows = conn.execute(
                "SELECT task_id, task_name, payload, status, created_at, updated_at FROM background_tasks WHERE status = ? ORDER BY created_at ASC LIMIT ?",
                ("queued", int(limit)),
            ).fetchall()
            for row in rows:
                tasks.append(
                    {
                        "task_id": row["task_id"],
                        "task_name": row["task_name"],
                        "payload": json.loads(row["payload"] or "{}"),
                        "status": row["status"],
                        "created_at": row["created_at"],
                        "updated_at": row["updated_at"],
                    }
                )
    except Exception:
        pass
    return tasks


def update_task_status(task_id: str, status: str, updated_payload: dict[str, Any] | None = None) -> bool:
    _ensure_task_table()
    try:
        with _create_connection() as conn:
            if updated_payload is not None:
                conn.execute(
                    "UPDATE background_tasks SET status = ?, payload = ?, updated_at = ? WHERE task_id = ?",
                    (
                        status,
                        json.dumps(updated_payload, default=str, ensure_ascii=False),
                        datetime.now(timezone.utc).isoformat(),
                        task_id,
                    ),
                )
            else:
                conn.execute(
                    "UPDATE background_tasks SET status = ?, updated_at = ? WHERE task_id = ?",
                    (
                        status,
                        datetime.now(timezone.utc).isoformat(),
                        task_id,
                    ),
                )
            conn.commit()
        return True
    except Exception:
        return False
