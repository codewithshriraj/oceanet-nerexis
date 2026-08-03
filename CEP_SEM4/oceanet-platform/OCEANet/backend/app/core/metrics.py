import threading
from typing import Dict

try:
    from prometheus_client import Counter as PrometheusCounter
except Exception:  # pragma: no cover - fallback for minimal environments
    PrometheusCounter = None

_lock = threading.Lock()
_counters: Dict[str, int] = {}

_http_requests_total = None
if PrometheusCounter is not None:
    try:
        _http_requests_total = PrometheusCounter(
            "oceanet_http_requests_total",
            "Total HTTP requests handled by the OCEANet API",
        )
    except ValueError:
        # Protect against re-imports during tests or reloads.
        _http_requests_total = None


def increment_counter(name: str, amount: int = 1) -> None:
    if name == "oceanet_http_requests_total" and _http_requests_total is not None:
        _http_requests_total.inc(amount)
        return

    with _lock:
        _counters[name] = _counters.get(name, 0) + amount


def get_counters_snapshot() -> Dict[str, int]:
    with _lock:
        return dict(_counters)


def render_prometheus_text() -> str:
    lines = []
    snapshot = get_counters_snapshot()
    for k, v in snapshot.items():
        lines.append(f"# HELP {k} Auto-instrumented counter")
        lines.append(f"# TYPE {k} counter")
        lines.append(f"{k} {v}")
    if not lines:
        return "# no metrics\n"
    return "\n".join(lines) + "\n"
