"""
Monitoring & metrics endpoint — /api/monitoring/metrics

Returns structured JSON telemetry useful for dashboards and alerts:
- API latency percentiles (tracked in-memory per-process)
- Error rates
- Active WebSocket connections
- Job queue depth

Exposed only to admin users in production. If you want to scrape this
with Prometheus, consider adding `prometheus_fastapi_instrumentator` as
a dependency and mounting it in server.py.
"""
import time
import logging
from collections import deque
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from .auth import require_role
from .db import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/monitoring", tags=["monitoring"])

# ── In-process rolling window for latency tracking ───────────────────────────
# RequestLoggingMiddleware can call record_latency() to push samples here.
_latency_window: deque = deque(maxlen=1000)   # last 1 000 request latencies (ms)
_error_counts: dict = {"4xx": 0, "5xx": 0}


def record_latency(elapsed_ms: float, status_code: int):
    """Called by RequestLoggingMiddleware for every request."""
    _latency_window.append(elapsed_ms)
    if 400 <= status_code < 500:
        _error_counts["4xx"] += 1
    elif status_code >= 500:
        _error_counts["5xx"] += 1


def _percentile(data: list, p: float) -> float:
    if not data:
        return 0.0
    sorted_data = sorted(data)
    idx = int(len(sorted_data) * p / 100)
    return round(sorted_data[min(idx, len(sorted_data) - 1)], 2)


@router.get("/metrics")
async def metrics(user: dict = Depends(require_role("admin"))):
    db = get_db()

    # Job queue stats
    pending   = await db.ibp_jobs.count_documents({"status": "PENDING"})
    running   = await db.ibp_jobs.count_documents({"status": "RUNNING"})
    completed = await db.ibp_jobs.count_documents({"status": "COMPLETED"})
    failed    = await db.ibp_jobs.count_documents({"status": "FAILED"})

    # Latency stats
    latencies = list(_latency_window)
    latency_stats = {
        "p50_ms":  _percentile(latencies, 50),
        "p95_ms":  _percentile(latencies, 95),
        "p99_ms":  _percentile(latencies, 99),
        "samples": len(latencies),
    }

    # Active WebSocket connections
    try:
        from .websocket_manager import manager
        ws_connections = sum(len(v) for v in manager._connections.values())
    except Exception:
        ws_connections = 0

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "jobs": {
            "pending": pending,
            "running": running,
            "completed": completed,
            "failed": failed,
            "error_rate_pct": round(failed / max(completed + failed, 1) * 100, 2),
        },
        "api_latency": latency_stats,
        "errors": _error_counts.copy(),
        "websockets": {"active_connections": ws_connections},
    }
