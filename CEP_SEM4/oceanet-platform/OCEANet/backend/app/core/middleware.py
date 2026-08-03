import contextvars
import logging
import time
import uuid
from .metrics import increment_counter

from fastapi import Request

request_id_ctx_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx_var.get("-")
        return True


async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    token = request_id_ctx_var.set(request_id)

    logger = logging.getLogger("nerexis.request")
    start = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        duration_ms = (time.perf_counter() - start) * 1000
        try:
            increment_counter("oceanet_http_requests_total")
        except Exception:
            pass
        logger.info(
            "%s %s completed in %.2fms",
            request.method,
            request.url.path,
            duration_ms,
        )
        request_id_ctx_var.reset(token)

    response.headers["x-request-id"] = request_id
    response.headers["x-process-time-ms"] = f"{duration_ms:.2f}"
    response.headers["x-content-type-options"] = "nosniff"
    response.headers["x-frame-options"] = "DENY"
    response.headers["referrer-policy"] = "same-origin"
    return response
