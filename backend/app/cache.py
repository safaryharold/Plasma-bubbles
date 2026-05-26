"""Caching utilities with Redis backend and in-process fallback.

Provides a small layer used by expensive endpoints — it will prefer Redis
when available but fall back to a bounded in-process dict so the app can
still run in minimal environments.
"""
import os
import json
import hashlib
import logging
from typing import Any, Optional
import asyncio

logger = logging.getLogger("ibp.cache")

_redis_client = None
_LOCAL_CACHE: dict = {}
_LOCAL_META: dict = {}  # key -> expiry_ts (epoch ms)
_MAX_LOCAL = int(os.environ.get("IBP_CACHE_LOCAL_MAX", "256"))
CACHE_TTL = int(os.environ.get("IBP_CACHE_TTL", "3600"))


def _make_key(prefix: str, params: dict) -> str:
    raw = json.dumps(params, sort_keys=True)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"ibp:{prefix}:{digest}"


def _get_redis_sync():
    # helper for non-async callers; returns None if redis not configured
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        return None
    try:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(redis_url, decode_responses=True)
        return _redis_client
    except Exception as exc:
        logger.warning("Redis unavailable: %s", exc)
        return None


async def cache_get(key: str) -> Optional[Any]:
    client = _get_redis_sync()
    if client is not None:
        try:
            v = await client.get(key)
            if v:
                return json.loads(v)
        except Exception as exc:
            logger.debug("Redis GET failed, falling back: %s", exc)

    # in-process fallback (respect TTL)
    meta = _LOCAL_META.get(key)
    if meta and meta < int(asyncio.get_event_loop().time() * 1000):
        _LOCAL_CACHE.pop(key, None)
        _LOCAL_META.pop(key, None)
        return None
    return _LOCAL_CACHE.get(key)


async def cache_set(key: str, value: Any, ttl: int = CACHE_TTL) -> bool:
    client = _get_redis_sync()
    serial = json.dumps(value)
    if client is not None:
        try:
            await client.setex(key, ttl, serial)
            return True
        except Exception as exc:
            logger.debug("Redis SET failed, falling back: %s", exc)

    # in-process fallback
    if len(_LOCAL_CACHE) >= _MAX_LOCAL:
        oldest = next(iter(_LOCAL_CACHE))
        _LOCAL_CACHE.pop(oldest, None)
        _LOCAL_META.pop(oldest, None)
    _LOCAL_CACHE[key] = value
    _LOCAL_META[key] = int(asyncio.get_event_loop().time() * 1000) + ttl * 1000
    return True


async def cache_delete(key: str) -> bool:
    client = _get_redis_sync()
    if client is not None:
        try:
            await client.delete(key)
            return True
        except Exception as exc:
            logger.debug("Redis DEL failed, falling back: %s", exc)
    _LOCAL_CACHE.pop(key, None)
    _LOCAL_META.pop(key, None)
    return True


def cache_key(prefix: str, params: dict) -> str:
    return _make_key(prefix, params)
