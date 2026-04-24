"""Celery app for async IBP batch jobs.

Falls back to FastAPI BackgroundTasks if Redis/Celery is unavailable.
The worker process runs sync Mongo (pymongo) and calls the same
ibp_service functions as the API.
"""
from __future__ import annotations
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from celery import Celery

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery = Celery(
    "ibp",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.celery_app"],
)
celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    broker_connection_retry_on_startup=True,
)


def _is_celery_ready() -> bool:
    try:
        import redis
        r = redis.from_url(REDIS_URL, socket_connect_timeout=0.5)
        return bool(r.ping())
    except Exception:
        return False


CELERY_READY = _is_celery_ready()


@celery.task(name="ibp.run_batch", bind=True)
def run_batch_task(self, job_id: str, params: dict):
    """Celery worker task: executes a sweep and updates MongoDB."""
    from datetime import datetime, timezone
    from pymongo import MongoClient
    from . import ibp_service

    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc).isoformat()
    db.ibp_jobs.update_one({"id": job_id},
                           {"$set": {"status": "RUNNING", "started_at": now,
                                     "worker": "celery", "task_id": self.request.id}})
    try:
        lons, lts = ibp_service.compute_grid(params)
        df = ibp_service.calculate(params["day_month"], lons, lts, params["f107"])
        grid = {}
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
        db.ibp_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "COMPLETED",
                      "completed_at": datetime.now(timezone.utc).isoformat(),
                      "summary": summary, "result": result_doc}})
    except Exception as exc:
        db.ibp_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "FAILED", "error": str(exc),
                      "completed_at": datetime.now(timezone.utc).isoformat()}})
    finally:
        client.close()


def dispatch_batch(job_id: str, params: dict, background_tasks=None):
    """Enqueue on Celery if ready, else fallback to FastAPI BackgroundTasks."""
    if CELERY_READY:
        try:
            run_batch_task.delay(job_id, params)
            return "celery"
        except Exception as exc:
            logger.exception("celery dispatch failed, falling back: %s", exc)
    # Fallback path — keeps environment working without Redis
    if background_tasks is not None:
        from .routes_ibp import _run_batch_job
        background_tasks.add_task(_run_batch_job, job_id, params)
    return "background_tasks"


def queue_stats() -> dict:
    """Best-effort introspection of the Celery queue."""
    if not CELERY_READY:
        return {"backend": "background_tasks", "workers": 0, "active": 0, "scheduled": 0, "reserved": 0}
    try:
        i = celery.control.inspect(timeout=0.5)
        active = i.active() or {}
        scheduled = i.scheduled() or {}
        reserved = i.reserved() or {}
        workers = list(active.keys())
        return {
            "backend": "celery",
            "redis_url": REDIS_URL,
            "workers": len(workers),
            "worker_names": workers,
            "active": sum(len(v) for v in active.values()),
            "scheduled": sum(len(v) for v in scheduled.values()),
            "reserved": sum(len(v) for v in reserved.values()),
        }
    except Exception as exc:
        return {"backend": "celery", "error": str(exc), "workers": 0, "active": 0}
