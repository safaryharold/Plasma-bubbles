"""Optional Redis caching layer for expensive IBP calculations.

Falls back to a simple in-process LRU dict when Redis is unavailable,
so the app degrades gracefully in environments without Redis.
"""
import os
import json
import hashlib
import logging
from functools import lru_cache
from typing import Any, Optional

logger = logging.getLogger(__name__)

_redis_client = None
_LOCAL_CACHE: dict = {}
_MAX_LOCAL = 256          # items cap for in-process fallback

CACHE_TTL = int(os.environ.get("IBP_CACHE_TTL", "3600"))   # 1 h default


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    redis_url = os.environ.get("REDIS_URL", "")
    if not redis_url:
        return None
    try:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(redis_url, decode_responses=True)
        return _redis_client
    except Exception as exc:
        logger.warning("Redis unavailable, using in-process cache: %s", exc)
        return None


def make_cache_key(prefix: str, params: dict) -> str:
    raw = json.dumps(params, sort_keys=True)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"ibp:{prefix}:{digest}"


async def cache_get(key: str) -> Optional[Any]:
    r = _get_redis()
    if r:
        try:
            v = await r.get(key)
            if v:
                return json.loads(v)
        except Exception as exc:
            logger.warning("Cache GET error: %s", exc)
    return _LOCAL_CACHE.get(key)


async def cache_set(key: str, value: Any, ttl: int = CACHE_TTL):
    r = _get_redis()
    serialised = json.dumps(value)
    if r:
        try:
            await r.setex(key, ttl, serialised)
            return
        except Exception as exc:
            logger.warning("Cache SET error: %s", exc)
    # In-process fallback with naive eviction
    if len(_LOCAL_CACHE) >= _MAX_LOCAL:
        oldest = next(iter(_LOCAL_CACHE))
        _LOCAL_CACHE.pop(oldest, None)
    _LOCAL_CACHE[key] = value
