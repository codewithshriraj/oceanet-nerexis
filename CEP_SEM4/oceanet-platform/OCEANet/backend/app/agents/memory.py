from __future__ import annotations

from typing import Any

AGENT_MEMORY_ENABLED = False


def get_agent_memory(agent_name: str) -> dict[str, Any]:
    return {
        "agent_name": agent_name,
        "memory": [],
        "message": "Agent memory placeholder. Enable persistent memory storage to share context across tasks.",
    }


def save_agent_memory(agent_name: str, memory: dict[str, Any]) -> dict[str, Any]:
    return {
        "agent_name": agent_name,
        "memory": memory,
        "message": "Agent memory persist placeholder. Implement Redis or database-backed memory store in production.",
    }
