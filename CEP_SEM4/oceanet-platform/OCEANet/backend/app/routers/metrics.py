from fastapi import APIRouter, Response

from ..core import metrics as core_metrics

try:
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
except Exception:
    generate_latest = None
    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4; charset=utf-8"


router = APIRouter()


@router.get("/metrics")
def metrics() -> Response:
    # Prefer prometheus_client if available; otherwise render in-process counters.
    if generate_latest is not None:
        data = generate_latest()
        return Response(content=data, media_type=CONTENT_TYPE_LATEST)
    # Fallback: render in-process metrics
    text = core_metrics.render_prometheus_text()
    return Response(content=text, media_type="text/plain; version=0.0.4; charset=utf-8")
