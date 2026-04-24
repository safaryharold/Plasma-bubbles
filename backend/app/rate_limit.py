"""Simple in-memory sliding-window rate limiter.

Limits differ by role:
- researcher: 60 req/min, 500/day
- pro:        600 req/min, 50_000/day
- admin:      unlimited
"""
from collections import deque
from time import time
from fastapi import HTTPException

LIMITS = {
    "researcher": {"minute": 60, "day": 500},
    "pro": {"minute": 600, "day": 50_000},
    "admin": {"minute": 10_000, "day": 1_000_000},
}

_buckets: dict[str, deque] = {}


def check(user: dict) -> None:
    role = user.get("role", "researcher")
    limit = LIMITS.get(role, LIMITS["researcher"])
    key = user["id"]
    now = time()
    buf = _buckets.setdefault(key, deque())
    # drop stamps older than a day
    while buf and buf[0] < now - 86400:
        buf.popleft()
    day_count = len(buf)
    minute_count = sum(1 for t in buf if t > now - 60)
    if minute_count >= limit["minute"]:
        raise HTTPException(status_code=429, detail=f"Rate limit: {limit['minute']} req/min ({role})")
    if day_count >= limit["day"]:
        raise HTTPException(status_code=429, detail=f"Rate limit: {limit['day']} req/day ({role})")
    buf.append(now)


def usage(user: dict) -> dict:
    role = user.get("role", "researcher")
    limit = LIMITS.get(role, LIMITS["researcher"])
    buf = _buckets.get(user["id"], deque())
    now = time()
    return {
        "role": role,
        "minute_used": sum(1 for t in buf if t > now - 60),
        "minute_limit": limit["minute"],
        "day_used": sum(1 for t in buf if t > now - 86400),
        "day_limit": limit["day"],
    }
