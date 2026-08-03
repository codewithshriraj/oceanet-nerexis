from __future__ import annotations

from typing import Any

from app.validators.datie import build_model_registry


def get_model_registry() -> list[dict[str, Any]]:
    return build_model_registry()
