"""Unauthenticated demo endpoints — used by the public landing page widget.

The world-map demo is the heaviest preview, so we compute it lazily and cache
the result in-process (single-worker uvicorn) for 1 hour. Subsequent hits
return the cached JSON instantly without hitting the GP regressor.

NOTE: parameters (day_month / f107 / lon_step / lat_step) are intentionally
hard-coded so the cache key space is 1 — this also means user input never
reaches the surrogate via this endpoint, removing the need for `IBP_GRID_CAP`
guardrails on the public path.
"""
from __future__ import annotations
import asyncio
import time
import logging
from fastapi import APIRouter
from . import ibp_service
from .version import __version__
from .cache import cache_get, cache_key, cache_set

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/public", tags=["public-demo"])


@router.get("/worldmap-demo")
async def worldmap_demo():
    """Lightweight preview of the global IBP overlay. No auth, no rate-limit."""
    day_month = 3
    f107 = 150.0
    lon_step = 20.0
    lat_step = 4.0
    key = cache_key(day_month, f107, lon_step, lat_step)
    cached = await cache_get(key)
    if cached:
        return cached
    # sklearn GP regressor is CPU-bound; off-load to a thread so the FastAPI
    # event-loop keeps serving other requests during the ~10s cold-hit warm-up.
    payload = await asyncio.to_thread(
        ibp_service.worldmap_grid,
        day_month, f107, lon_step, 25.0, lat_step,
    )
    payload["preview"] = True
    payload["caption"] = ("March equinox, F10.7=150 — illustrative preview. "
                          "Sign in to run custom sweeps, exports, and 3D climatologies.")
    await cache_set(key, payload, ttl=3600)
    return payload


@router.get("/meta")
async def public_meta():
    """Public metadata for the landing footer."""
    return {
        "model_source": ibp_service.MODEL_SOURCE,
        "platform": "IBP Analytics Platform",
        "version": __version__,
    }
