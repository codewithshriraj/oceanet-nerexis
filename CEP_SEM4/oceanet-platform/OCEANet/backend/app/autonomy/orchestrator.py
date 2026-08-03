from __future__ import annotations

from typing import Any

from app.autonomy.kg_adapter import is_enabled as kg_enabled
from app.rag.qdrant_adapter import is_enabled as rag_enabled
from app.autonomy.memory import get_agent_memory


def plan_task(agent_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    agent_key = agent_name.strip().lower()
    memory = get_agent_memory(agent_key)
    tools = ["datie", "forecast", "biodiversity", "digital_twin"]
    if kg_enabled():
        tools.append("knowledge_graph")
    if rag_enabled():
        tools.append("rag_search")

    if agent_key in {"data_validation", "validation", "data-validation"}:
        steps = [
            {"step": "identify_entity", "description": "Inspect payload for dataset or report identifiers."},
            {"step": "evaluate_trust", "description": "Compute DATIE scores and confidence intervals."},
            {"step": "compile_summary", "description": "Produce a validation summary and recommended risk band."},
        ]
    elif agent_key in {"research", "research_agent"}:
        steps = [
            {"step": "gather_context", "description": "Load dataset trust, KG context, and RAG evidence if available."},
            {"step": "generate_insight", "description": "Create a research narrative with environmental intelligence and citations."},
            {"step": "store_memory", "description": "Persist research context for follow-up tasks."},
        ]
    elif agent_key in {"forecast", "forecasting", "forecast_agent"}:
        steps = [
            {"step": "load_timeseries", "description": "Extract numeric series from the dataset and build a forecast."},
            {"step": "score_risk", "description": "Map forecast trend to environmental risk bands."},
        ]
    elif agent_key in {"biodiversity", "biodiversity_agent"}:
        steps = [
            {"step": "analyze_dataset", "description": "Detect ecological anomalies and species signals."},
            {"step": "correlate_events", "description": "Link biodiversity findings to dataset trust and region."},
        ]
    elif agent_key in {"risk_assessment", "risk_agent"}:
        steps = [
            {"step": "collect_signals", "description": "Combine trust, forecast, and biodiversity indicators."},
            {"step": "score_risk", "description": "Create a unified operational risk score."},
        ]
    elif agent_key in {"scientific_report", "report_agent"}:
        steps = [
            {"step": "create_outline", "description": "Build a report structure from dataset and trust metrics."},
            {"step": "generate_narrative", "description": "Compose science-ready findings and recommendations."},
        ]
    else:
        steps = [
            {"step": "analyze_input", "description": "Inspect payload and determine best available tools."},
            {"step": "execute_action", "description": "Route the request to the most relevant autonomous capability."},
        ]

    return {
        "agent_name": agent_name,
        "payload": payload,
        "plan": {
            "steps": steps,
            "tools": tools,
            "memory_snapshot": memory,
        },
        "status": "planned",
        "message": "Task plan created based on current platform capabilities.",
    }
