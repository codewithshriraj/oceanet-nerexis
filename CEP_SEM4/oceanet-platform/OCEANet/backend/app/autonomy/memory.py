from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any

REDIS_ENABLED = os.getenv("OCEANET_REDIS_ENABLED", "0").strip().lower() in {"1", "true", "yes"}
REDIS_HOST = os.getenv("OCEANET_REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("OCEANET_REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("OCEANET_REDIS_DB", "0"))

DATA_ROOT = os.getenv("OCEANET_DATA_ROOT", os.path.join(os.path.dirname(__file__), "..", "..", "data"))
DB_PATH = os.getenv("OCEANET_DB_PATH", os.path.join(DATA_ROOT, "oceanet_auth.db"))


def _create_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout = 2000")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def _ensure_table() -> None:
    try:
        with _create_connection() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS agent_memory (agent_name TEXT PRIMARY KEY, memory TEXT, updated_at TEXT)"
            )
            conn.commit()
    except Exception:
        pass


def _serialize(memory: dict[str, Any]) -> str:
    return json.dumps(memory, default=str, ensure_ascii=False)


def _deserialize(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        return json.loads(value)
    except Exception:
        return {}


def _redis_client() -> Any | None:
    if not REDIS_ENABLED:
        return None
    try:
        import redis

        return redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)
    except Exception:
        return None


def get_agent_memory(agent_name: str) -> dict[str, Any]:
    if REDIS_ENABLED:
        client = _redis_client()
        if client is not None:
            try:
                payload = client.get(f"agent_memory:{agent_name}")
                return _deserialize(payload)
            except Exception:
                pass

    _ensure_table()
    try:
        with _create_connection() as conn:
            row = conn.execute(
                "SELECT memory FROM agent_memory WHERE agent_name = ?", (agent_name,)
            ).fetchone()
            return _deserialize(row[0] if row else None)
    except Exception:
        return {}


def save_agent_memory(agent_name: str, memory: dict[str, Any]) -> dict[str, Any]:
    updated_at = datetime.now(timezone.utc).isoformat()
    serialized = _serialize(memory)

    if REDIS_ENABLED:
        client = _redis_client()
        if client is not None:
            try:
                client.set(f"agent_memory:{agent_name}", serialized)
                return {
                    "agent_name": agent_name,
                    "memory": memory,
                    "updated_at": updated_at,
                    "storage": "redis",
                }
            except Exception:
                pass

    _ensure_table()
    try:
        with _create_connection() as conn:
            conn.execute(
                "INSERT INTO agent_memory (agent_name, memory, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(agent_name) DO UPDATE SET memory = excluded.memory, updated_at = excluded.updated_at",
                (agent_name, serialized, updated_at),
            )
            conn.commit()
    except Exception:
        pass

    return {
        "agent_name": agent_name,
        "memory": memory,
        "updated_at": updated_at,
        "storage": "sqlite",
    }
