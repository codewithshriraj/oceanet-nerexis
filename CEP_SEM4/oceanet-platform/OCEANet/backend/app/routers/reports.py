from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from ..services.legacy_bridge import get_legacy_module, parse_request_model

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/generate")
async def generate_report(payload: dict[str, Any]):
    legacy = get_legacy_module()
    request_model = parse_request_model(legacy.ReportGenerateRequest, payload)
    return await legacy.generate_report(request_model)


@router.get("/")
async def list_reports(
    region: str | None = Query(default=None),
    report_type: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=500),
):
    legacy = get_legacy_module()

    return await legacy.list_reports(region=region, report_type=report_type, limit=limit)


@router.get("/{report_id}")
async def get_report(report_id: int):
    legacy = get_legacy_module()

    return await legacy.get_report(report_id)


@router.get("/{report_id}/download")
async def download_report(report_id: int, format: str = Query(default="txt")):
    legacy = get_legacy_module()

    return await legacy.download_report(report_id, format)


@router.post("/export")
async def export_report(payload: dict[str, Any]):
    legacy = get_legacy_module()

    title = str(payload.get("title") or "report").strip() or "report"
    content = str(payload.get("content") or "")
    selected_format = str(payload.get("format") or "txt").strip().lower()

    if selected_format not in {"txt", "pdf", "docx"}:
        raise HTTPException(status_code=400, detail="Unsupported download format. Use txt, pdf, or docx")

    safe_filename = legacy._safe_filename(title)  # pylint: disable=protected-access

    if selected_format == "pdf":
        pdf_bytes = legacy._build_report_pdf_bytes(title, content)  # pylint: disable=protected-access
        headers = {"Content-Disposition": f'attachment; filename="{safe_filename}.pdf"'}
        return StreamingResponse(iter([pdf_bytes]), media_type="application/pdf", headers=headers)

    if selected_format == "docx":
        docx_bytes = legacy._build_report_docx_bytes(title, content)  # pylint: disable=protected-access
        headers = {"Content-Disposition": f'attachment; filename="{safe_filename}.docx"'}
        return StreamingResponse(
            iter([docx_bytes]),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers=headers,
        )

    txt_bytes = content.encode("utf-8")
    headers = {"Content-Disposition": f'attachment; filename="{safe_filename}.txt"'}
    return StreamingResponse(iter([txt_bytes]), media_type="text/plain; charset=utf-8", headers=headers)


@router.post("/{report_id}/share")
async def share_report(report_id: int, request: Request):
    legacy = get_legacy_module()

    return await legacy.share_report(report_id, request)


@router.get("/shared/{share_token}")
async def get_shared_report(share_token: str):
    legacy = get_legacy_module()

    return await legacy.get_shared_report(share_token)


@router.post("/sync/trigger")
async def trigger_report_sync(authorization: str | None = Header(default=None)):
    legacy = get_legacy_module()

    return await legacy.trigger_report_sync(authorization=authorization)


@router.get("/sync/status")
async def report_sync_status():
    legacy = get_legacy_module()

    return await legacy.report_sync_status()
