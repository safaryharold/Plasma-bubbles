"""Webhook notification endpoints.

Users can register a URL; the platform POSTs a signed JSON payload there
when one of their jobs reaches COMPLETED or FAILED.

POST /api/webhooks          — register
GET  /api/webhooks          — list yours
DELETE /api/webhooks/{id}   — remove
"""
import uuid
import hmac
import hashlib
import logging
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from .auth import get_current_user
from .db import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class WebhookCreate(BaseModel):
    url: HttpUrl
    secret: str = ""           # optional HMAC signing secret


class WebhookOut(BaseModel):
    id: str
    url: str
    created_at: str
    active: bool = True


@router.post("", response_model=WebhookOut)
async def create_webhook(body: WebhookCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "url": str(body.url),
        "secret": body.secret,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.webhooks.insert_one(doc.copy())
    doc.pop("_id", None)
    doc.pop("secret", None)
    return doc


@router.get("", response_model=list[WebhookOut])
async def list_webhooks(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = await db.webhooks.find(
        {"user_id": user["id"], "active": True}, {"_id": 0, "secret": 0}
    ).to_list(50)
    return docs


@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.webhooks.update_one(
        {"id": webhook_id, "user_id": user["id"]},
        {"$set": {"active": False}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"ok": True}


# ── Internal helper called by tasks_local after job finishes ──────────────────

async def notify_job_complete(user_id: str, job: dict):
    """Fire-and-forget POST to every active webhook registered by user_id."""
    db = get_db()
    hooks = await db.webhooks.find({"user_id": user_id, "active": True}).to_list(20)
    if not hooks:
        return
    payload = {
        "event": "job.completed" if job["status"] == "COMPLETED" else "job.failed",
        "job_id": job["id"],
        "status": job["status"],
        "name": job.get("name"),
        "cells": job.get("cells"),
        "completed_at": job.get("completed_at"),
        "error": job.get("error"),
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        for hook in hooks:
            try:
                headers = {"Content-Type": "application/json"}
                if hook.get("secret"):
                    import json
                    body_bytes = json.dumps(payload).encode()
                    sig = hmac.new(hook["secret"].encode(), body_bytes, hashlib.sha256).hexdigest()
                    headers["X-IBP-Signature"] = f"sha256={sig}"
                await client.post(hook["url"], json=payload, headers=headers)
                logger.info("Webhook fired: %s -> %s", payload["event"], hook["url"])
            except Exception as exc:
                logger.warning("Webhook delivery failed %s: %s", hook["url"], exc)
