"""Persistent auth rate-limiter backed by MongoDB.

The previous in-memory `dict` did not survive backend restarts or scale
horizontally across multi-pod deploys. This module stores one document per
email with `attempts` count and a TTL-indexed `expires_at` so MongoDB
garbage-collects stale lockouts automatically (no cron needed).

Schema (collection `auth_attempts`):
    { _id: <email_lower>, attempts: int, last_attempt: datetime,
      expires_at: datetime }

A TTL index on `expires_at` (created in server.py startup) deletes documents
15 min after the last failed attempt.
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from .db import get_db

MAX_ATTEMPTS = 5
WINDOW_MIN = 15


async def check_rate_limit(email: str) -> None:
    """Raise 429 if the email has failed >=MAX_ATTEMPTS in the last WINDOW_MIN."""
    key = email.lower()
    doc = await get_db().auth_attempts.find_one({"_id": key})
    if not doc:
        return
    if doc.get("attempts", 0) >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")


async def record_failed_attempt(email: str) -> None:
    """Increment the per-email failed-attempt counter, refreshing the TTL."""
    key = email.lower()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=WINDOW_MIN)
    await get_db().auth_attempts.update_one(
        {"_id": key},
        {"$inc": {"attempts": 1},
         "$set": {"last_attempt": now.isoformat(), "expires_at": expires_at}},
        upsert=True,
    )


async def clear_attempts(email: str) -> None:
    """Successful login resets the lockout counter."""
    await get_db().auth_attempts.delete_one({"_id": email.lower()})
