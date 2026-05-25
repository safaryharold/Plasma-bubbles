"""Unauthenticated demo endpoints — used by the public landing page widget.

The world-map demo is the heaviest preview, so we compute it lazily and cache
the result in-process (single-worker uvicorn) for 1 hour. Subsequent hits
return the cached JSON instantly without hitting the GP regressor.
"""
from __future__ import annotations
import time
import logging
from fastapi import APIRouter
from . import ibp_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/public", tags=["public-demo"])

# (day_month, f107, lon_step, lat_step) → (expires_at_ts, payload)
_CACHE: dict = {}
_TTL_SEC = 60 * 60  # 1 hour


def _cache_get(key):
    entry = _CACHE.get(key)
    if entry and entry[0] > time.time():
        return entry[1]
    return None


def _cache_put(key, value):
    _CACHE[key] = (time.time() + _TTL_SEC, value)


@router.get("/worldmap-demo")
async def worldmap_demo():
    """Lightweight preview of the global IBP overlay. No auth, no rate-limit.

    Fixed parameters keep the cache hit-rate high (~100% after first warm-up)
    and prevent scraping for arbitrary data. Researchers who want custom grids
    must log in.
    """
    day_month = 3   # March equinox — most visually striking
    f107 = 150.0    # nominal solar flux
    lon_step = 20.0
    lat_step = 4.0
    key = (day_month, f107, lon_step, lat_step)
    cached = _cache_get(key)
    if cached:
        return cached
    payload = ibp_service.worldmap_grid(day_month, f107, lon_step,
                                        lat_half_range=25.0, lat_step=lat_step)
    payload["preview"] = True
    payload["caption"] = ("March equinox, F10.7=150 — illustrative preview. "
                          "Sign in to run custom sweeps, exports, and 3D climatologies.")
    _cache_put(key, payload)
    return payload


@router.get("/meta")
async def public_meta():
    """Public metadata so the landing page can render the platform footer
    (model name, version) without an authenticated round-trip."""
    return {
        "model_source": ibp_service.MODEL_SOURCE,
        "platform": "IBP Analytics Platform",
        "version": "1.5.1",
    }
