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

        # Notify subscribers (WS clients + registered webhooks)
        job_doc = await db.ibp_jobs.find_one({"id": job_id}, {"_id": 0, "result": 0})
        if job_doc:
            from .routes_ws import broadcast_job_update
            from .routes_webhooks import trigger_webhooks
            await broadcast_job_update(job_doc["user_id"], job_id, "COMPLETED", summary)
            await trigger_webhooks(job_doc["user_id"], "job.completed", job_id,
                                   {"summary": summary, "params": job_doc.get("params")})

    except Exception as exc:
        logger.error("Batch job %s failed: %s", job_id, exc)
        await db.ibp_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "FAILED", "error": str(exc),
                      "completed_at": datetime.now(timezone.utc).isoformat()}},
        )
        job_doc = await db.ibp_jobs.find_one({"id": job_id}, {"_id": 0, "result": 0})
        if job_doc:
            from .routes_ws import broadcast_job_update
            from .routes_webhooks import trigger_webhooks
            await broadcast_job_update(job_doc["user_id"], job_id, "FAILED", {"error": str(exc)})
            await trigger_webhooks(job_doc["user_id"], "job.failed", job_id, {"error": str(exc)})
