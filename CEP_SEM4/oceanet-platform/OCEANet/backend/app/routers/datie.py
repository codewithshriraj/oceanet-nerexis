from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.validators.datie import (
    build_research_brief_markdown,
    export_markdown,
    evaluate_dataset,
    evaluate_report,
    get_model_registry,
    summarize,
)

router = APIRouter(prefix="/datie", tags=["datie"])


@router.get("/summary")
async def get_summary() -> dict:
    return summarize()


@router.get("/datasets/{dataset_id}")
async def get_dataset_datie(dataset_id: int) -> dict:
    try:
        return evaluate_dataset(dataset_id).to_dict()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/reports/{report_id}")
async def get_report_datie(report_id: int) -> dict:
    try:
        return evaluate_report(report_id).to_dict()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/model-registry")
async def datie_model_registry() -> dict:
    return {"models": get_model_registry()}


@router.get("/research")
async def datie_research() -> dict:
    return {
        "research_brief": build_research_brief_markdown(),
    }


@router.get("/export/{entity_type}/{entity_id}")
async def datie_export(
    entity_type: str,
    entity_id: int,
    format: str = Query(default="json", pattern="^(json|md)$"),
):
    normalized = entity_type.strip().lower()
    if normalized not in {"dataset", "report"}:
        raise HTTPException(status_code=400, detail="entity_type must be 'dataset' or 'report'")

    if format == "md":
        markdown = export_markdown(normalized, entity_id)
        return PlainTextResponse(markdown, media_type="text/markdown")

    if normalized == "dataset":
        try:
            payload = evaluate_dataset(entity_id).to_dict()
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    else:
        try:
            payload = evaluate_report(entity_id).to_dict()
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    return payload
