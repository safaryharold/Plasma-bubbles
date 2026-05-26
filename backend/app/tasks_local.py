"""In-process batch runner used as a fallback when Celery is unavailable.

Extracted from `routes_ibp.py` to break the circular import between
`celery_app.py` and `routes_ibp.py`.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from .db import get_db
from . import ibp_service

logger = logging.getLogger(__name__)


async def run_batch_job(job_id: str, params: dict) -> None:
    """Async in-process runner — same outputs as the Celery worker task."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    await db.ibp_jobs.update_one(
        {"id": job_id},
        {"$set": {"status": "RUNNING", "started_at": now, "worker": "background_tasks"}},
    )

    # Broadcast RUNNING status via WebSocket
    await _ws_update(db, job_id)

    try:
        lons, lts = ibp_service.compute_grid(params)
        df = ibp_service.calculate(params["day_month"], lons, lts, params["f107"])
        grid: dict = {}
        for _, row in df.iterrows():
            grid.setdefault(float(row["Lon"]), {})[float(row["LT"])] = float(row["IBP"])
        summary = {
            "count": int(len(df)),
            "ibp_min": float(df["IBP"].min()),
            "ibp_max": float(df["IBP"].max()),
            "ibp_mean": float(df["IBP"].mean()),
            "ibp_p95": float(df["IBP"].quantile(0.95)),
            "hotspots": df.nlargest(5, "IBP")[["Lon", "LT", "IBP"]].to_dict(orient="records"),
        }
        result_doc = {
            "lons": lons, "lts": lts,
            "matrix": [[grid.get(ln, {}).get(t, 0.0) for t in lts] for ln in lons],
            "doy": int(df.iloc[0]["Doy"]),
            "month": int(df.iloc[0]["Month"]),
        }
        await db.ibp_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "COMPLETED",
                      "completed_at": datetime.now(timezone.utc).isoformat(),
                      "summary": summary, "result": result_doc}},
        )
        # Notify via WS and webhooks
        await _ws_update(db, job_id)
        await _webhook_notify(db, job_id)

    except Exception as exc:
        logger.error("Batch job %s failed: %s", job_id, exc)
        await db.ibp_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "FAILED", "error": str(exc),
                      "completed_at": datetime.now(timezone.utc).isoformat()}},
        )
        await _ws_update(db, job_id)
        await _webhook_notify(db, job_id)


async def _ws_update(db, job_id: str):
    """Push current job state to connected WebSocket clients (best-effort)."""
    try:
        from .websocket_manager import manager
        job = await db.ibp_jobs.find_one({"id": job_id}, {"_id": 0, "result": 0})
        if job:
            await manager.broadcast_job(job["user_id"], job)
    except Exception as exc:
        logger.debug("WS broadcast skipped: %s", exc)


async def _webhook_notify(db, job_id: str):
    """Fire webhook for the job's owner (best-effort)."""
    try:
        from .routes_webhook import notify_job_complete
        job = await db.ibp_jobs.find_one({"id": job_id}, {"_id": 0, "result": 0})
        if job:
            await notify_job_complete(job["user_id"], job)
    except Exception as exc:
        logger.debug("Webhook notify skipped: %s", exc)
