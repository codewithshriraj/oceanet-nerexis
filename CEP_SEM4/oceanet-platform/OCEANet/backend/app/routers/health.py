import os
import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["ops"])


@router.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "environment": settings.app_env,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ready")
async def readiness() -> dict:
    db_ok = False
    db_error = None

    try:
        if os.path.exists(settings.db_path):
            with sqlite3.connect(settings.db_path, timeout=2) as conn:
                conn.execute("SELECT 1")
        db_ok = True
    except Exception as exc:
        db_error = str(exc)

    return {
        "status": "ready" if db_ok else "degraded",
        "checks": {
            "database": {
                "ok": db_ok,
                "error": db_error,
                "path": settings.db_path,
            }
        },
    }
