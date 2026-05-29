"""IBP Analytics Platform — FastAPI entrypoint."""
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import os  # noqa: E402
import logging  # noqa: E402
from datetime import datetime, timezone
from fastapi import FastAPI, APIRouter  # noqa: E402
from fastapi.openapi.utils import get_openapi
from starlette.middleware.cors import CORSMiddleware  # noqa: E402
from starlette.middleware.gzip import GZipMiddleware  # noqa: E402

from app.db import get_db, get_client  # noqa: E402
from app.auth import seed_admin  # noqa: E402
from app.middleware import LoggingMiddleware  # noqa: E402
from app.middleware_logging import RequestLoggingMiddleware  # noqa: E402
from app.routes_auth import router as auth_router  # noqa: E402
from app.routes_ibp import router as ibp_router  # noqa: E402
from app.routes_experiments import router as exp_router  # noqa: E402
from app.routes_keys import router as keys_router  # noqa: E402
from app.routes_admin import router as admin_router  # noqa: E402
from app.routes_share import router as share_router, public_router  # noqa: E402
from app.routes_public import router as public_demo_router  # noqa: E402
from app.routes_ws import router as ws_router  # noqa: E402
from app.routes_webhooks import router as webhooks_router  # noqa: E402
from app.routes_monitoring import router as monitoring_router  # noqa: E402


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger("ibp")

app = FastAPI(
    title="IBP Analytics Platform",
    version="1.1.0",
    description=(
        "Scientific & commercial platform for Ionospheric Bubble Probability (IBP) modelling.\n"
        "Most endpoints require a valid session cookie (access_token) or x-api-key header."
    ),
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)


# Mount API router
api = APIRouter(prefix="/api")


@api.get("/", tags=["meta"])
async def root():
    return {"service": "IBP Analytics Platform", "status": "ok"}


@api.get("/health", tags=["meta"])
async def health():
    try:
        db = get_db()
        await db.command("ping")
        db_status = "ok"
    except Exception as exc:
        db_status = f"error: {exc.__class__.__name__}"

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
        "version": __import__("app.version", fromlist=["__version__"]).__version__,
        "database": db_status,
        "redis": redis_status,
        "celery_workers": celery_workers,
        "model_source": __import__("app.ibp_service", fromlist=["MODEL_SOURCE"]).MODEL_SOURCE,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# Register API routes
api.include_router(auth_router)
api.include_router(ibp_router)
api.include_router(exp_router)
api.include_router(keys_router)
api.include_router(admin_router)
api.include_router(share_router)
api.include_router(public_router)
api.include_router(public_demo_router)
api.include_router(webhooks_router)
api.include_router(monitoring_router)


# Global middleware — order matters
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api)
# WS endpoint registered at root (no /api prefix)
app.include_router(ws_router)


@app.on_event("startup")
async def startup():
    db = get_db()
    # Core indexes (idempotent)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.ibp_jobs.create_index("id", unique=True)
    await db.ibp_jobs.create_index("user_id")
    await db.ibp_jobs.create_index("created_at")
    await db.ibp_jobs.create_index("status")
    await db.ibp_jobs.create_index([("user_id", 1), ("config_hash", 1), ("status", 1)])
    await db.webhooks.create_index("user_id")
    await db.experiments.create_index("id", unique=True)
    await db.experiments.create_index("user_id")
    await db.api_keys.create_index("id", unique=True)
    await db.api_keys.create_index("key_hash", unique=True)
    await db.export_presets.create_index("id", unique=True)
    await db.export_presets.create_index("exp_id")
    await db.export_presets.create_index("user_id")
    await db.shares.create_index("token", unique=True)
    await db.shares.create_index("user_id")
    await db.webhooks.create_index("user_id")
    await db.auth_attempts.create_index("expires_at", expireAfterSeconds=0)
    await seed_admin()
    logger.info("IBP platform ready.")


@app.on_event("shutdown")
async def shutdown():
    get_client().close()
    await db.ibp_jobs.create_index([("user_id", 1), ("status", 1)])   # compound for dashboard
