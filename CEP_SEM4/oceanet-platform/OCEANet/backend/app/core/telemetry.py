from __future__ import annotations

import os
from typing import Any

try:
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
except Exception:
    trace = None
    TracerProvider = None
    BatchSpanProcessor = None
    ConsoleSpanExporter = None
    OTLPSpanExporter = None
    FastAPIInstrumentor = None


def is_enabled() -> bool:
    return os.getenv("OCEANET_OTEL_ENABLED", "0").strip().lower() in {"1", "true", "yes"}


def _get_otel_exporter() -> Any:
    endpoint = os.getenv("OCEANET_OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    headers = os.getenv("OCEANET_OTEL_EXPORTER_OTLP_HEADERS", "").strip()
    if endpoint and OTLPSpanExporter is not None:
        kwargs: dict[str, Any] = {"endpoint": endpoint}
        if headers:
            kwargs["headers"] = dict(item.split("=") for item in headers.split(",") if "=" in item)
        return OTLPSpanExporter(**kwargs)
    return ConsoleSpanExporter()


def setup_telemetry(app: Any | None = None) -> dict[str, Any]:
    if trace is None or not is_enabled() or TracerProvider is None or BatchSpanProcessor is None or ConsoleSpanExporter is None:
        return {"enabled": False, "message": "OpenTelemetry is not configured or dependencies are missing."}

    resource = Resource.create({"service.name": os.getenv("OCEANET_SERVICE_NAME", "nerexis-backend")})
    provider = TracerProvider(resource=resource)
    exporter = _get_otel_exporter()
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    instrumented = False
    if app is not None and FastAPIInstrumentor is not None:
        try:
            FastAPIInstrumentor.instrument_app(app)
            instrumented = True
        except Exception:
            instrumented = False

    tracer = trace.get_tracer(__name__)
    return {
        "enabled": True,
        "message": "OpenTelemetry tracing initialized.",
        "instrumented": instrumented,
        "provider": str(provider),
        "tracer": str(tracer),
    }
