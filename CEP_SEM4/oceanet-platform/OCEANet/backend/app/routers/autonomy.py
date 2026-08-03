from __future__ import annotations

from fastapi import APIRouter, Body, HTTPException, Query
from typing import Any

from app.autonomy.datie_explain import get_trust_score_breakdown
from app.autonomy.digital_twin import simulate_scenario
from app.autonomy.event_detection import detect_events
from app.autonomy.forecast_intelligence import forecast_dataset
from app.autonomy.kg_adapter import is_enabled as kg_enabled, query_kg
from app.autonomy.memory import get_agent_memory, save_agent_memory
from app.autonomy.orchestrator import plan_task
from app.autonomy.research_copilot import answer_query
from app.autonomy.agents import load_agent_task, run_agent
from app.autonomy.scientific_report import generate_scientific_report
from app.tasks.worker import get_queued_tasks

router = APIRouter(prefix="/api/v1/autonomy", tags=["autonomy"])


@router.post("/research-copilot/query")
async def research_copilot_query(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    return answer_query(payload)


@router.get("/datie/{entity_type}/{entity_id}/trust-breakdown")
async def datie_trust_breakdown(entity_type: str, entity_id: int) -> dict[str, Any]:
    try:
        return get_trust_score_breakdown(entity_type, entity_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/forecast/predict")
async def forecast_predict(
    payload: dict[str, Any] = Body(...),
) -> dict[str, Any]:
    try:
        dataset_id = int(payload.get("dataset_id", 0))
        horizon = int(payload.get("horizon", 7))
        forecast_type = str(payload.get("forecast_type", "environment"))
        return forecast_dataset(dataset_id, horizon=horizon, forecast_type=forecast_type)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/events/detect")
async def events_detect(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    dataset_id = payload.get("dataset_id")
    try:
        if dataset_id is not None:
            dataset_id = int(dataset_id)
        return detect_events(dataset_id=dataset_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/events/{dataset_id}")
async def events_for_dataset(dataset_id: int) -> dict[str, Any]:
    return detect_events(dataset_id=dataset_id)


@router.post("/agents/run")
async def agents_run(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    agent_name = str(payload.get("agent_name") or "").strip()
    if not agent_name:
        raise HTTPException(status_code=400, detail="agent_name is required")
    return run_agent(agent_name, payload.get("input_payload") or {})


@router.post("/agents/plan")
async def agents_plan(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    agent_name = str(payload.get("agent_name") or "").strip()
    if not agent_name:
        raise HTTPException(status_code=400, detail="agent_name is required")
    return plan_task(agent_name, payload.get("input_payload") or {})


@router.post("/agents/memory")
async def agent_memory(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    agent_name = str(payload.get("agent_name") or "").strip()
    if not agent_name:
        raise HTTPException(status_code=400, detail="agent_name is required")
    memory = payload.get("memory") if isinstance(payload.get("memory"), dict) else {}
    return save_agent_memory(agent_name, memory)


@router.get("/agents/memory/{agent_name}")
async def get_memory(agent_name: str) -> dict[str, Any]:
    return get_agent_memory(agent_name)


@router.get("/agents/{task_id}")
async def agent_status(task_id: str) -> dict[str, Any]:
    task = load_agent_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Agent task not found")
    return task


@router.get("/background/tasks")
async def background_tasks(limit: int = Query(10, ge=1, le=100)) -> dict[str, Any]:
    return {"queued_tasks": get_queued_tasks(limit)}


@router.post("/reports/scientific")
async def scientific_report(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    return generate_scientific_report(payload)


@router.post("/kg/query")
async def kg_query(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    query_text = str(payload.get("query") or "").strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="query text is required")
    return query_kg(query_text)


@router.get("/kg/status")
async def kg_status() -> dict[str, Any]:
    return {"enabled": kg_enabled()}


@router.post("/digital-twin/simulate")
async def digital_twin_simulate(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    return simulate_scenario(payload)


@router.get("/digital-twin/health")
async def digital_twin_health() -> dict[str, Any]:
    return {"status": "ok", "service": "digital-twin", "enabled": True}
