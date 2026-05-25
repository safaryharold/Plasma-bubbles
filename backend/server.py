"""IBP Analytics Platform — FastAPI entrypoint."""
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import os  # noqa: E402
import logging  # noqa: E402
from datetime import datetime, timezone
from fastapi import FastAPI, APIRouter  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from app.db import get_db, get_client  # noqa: E402
from app.auth import seed_admin  # noqa: E402
from app.routes_auth import router as auth_router  # noqa: E402
from app.routes_ibp import router as ibp_router  # noqa: E402
from app.routes_experiments import router as exp_router  # noqa: E402
from app.routes_keys import router as keys_router  # noqa: E402
from app.routes_admin import router as admin_router  # noqa: E402
from app.routes_share import router as share_router, public_router  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger("ibp")

app = FastAPI(title="IBP Analytics Platform", version="1.0.0",
              description="Scientific & commercial platform for Ionospheric Bubble Probability modelling.")

api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"service": "IBP Analytics Platform", "status": "ok"}


@api.get("/health")
async def health():
    # Check database connection
    try:
        db = get_db()
        await db.command("ping")
        db_status = "ok"
    except Exception as exc:
        db_status = f"error: {exc.__class__.__name__}"

    # Check Redis + Celery worker availability
    try:
        from app.celery_app import CELERY_READY, queue_stats
        redis_status = "ok" if CELERY_READY else "not configured"
        celery_workers = queue_stats().get("workers", 0) if CELERY_READY else 0
    except Exception:
        redis_status = "error"
        celery_workers = 0

    overall = "ok" if db_status == "ok" and (redis_status in ("ok", "not configured")) else "degraded"
    return {
        "status": overall,
        "version": "1.5.0",
        "database": db_status,
        "redis": redis_status,
        "celery_workers": celery_workers,
        "model_source": __import__("app.ibp_service", fromlist=["MODEL_SOURCE"]).MODEL_SOURCE,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


api.include_router(auth_router)
api.include_router(ibp_router)
api.include_router(exp_router)
api.include_router(keys_router)
api.include_router(admin_router)
api.include_router(share_router)
api.include_router(public_router)

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.ibp_jobs.create_index("id", unique=True)
    await db.ibp_jobs.create_index("user_id")
    await db.ibp_jobs.create_index("created_at")
    await db.experiments.create_index("id", unique=True)
    await db.experiments.create_index("user_id")
    await db.api_keys.create_index("id", unique=True)
    await db.api_keys.create_index("key_hash", unique=True)
    await db.shares.create_index("token", unique=True)
    await db.shares.create_index("user_id")
    await seed_admin()
    logger.info("IBP platform ready.")


@app.on_event("shutdown")
async def shutdown():
    get_client().close()
