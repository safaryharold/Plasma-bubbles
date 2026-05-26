"""Webhook management for job completion notifications."""
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from .auth import get_current_user
from .db import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("")
async def create_webhook(url: str, events: list[str], user: dict = Depends(get_current_user)):
    """Create a webhook subscription for job events."""
    if not url or not url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid webhook URL")

    valid_events = {"job.started", "job.completed", "job.failed"}
    if not events or not all(e in valid_events for e in events):
        raise HTTPException(status_code=400, detail=f"Valid events: {valid_events}")

    webhook = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "url": url,
        "events": events,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    db = get_db()
    await db.webhooks.insert_one(webhook)
    webhook.pop("_id", None)
    return webhook


@router.get("")
async def list_webhooks(user: dict = Depends(get_current_user)):
    """List all webhooks for the current user."""
    db = get_db()
    webhooks = await db.webhooks.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return webhooks


@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: str, user: dict = Depends(get_current_user)):
    """Delete a webhook subscription."""
    db = get_db()
    res = await db.webhooks.delete_one({"id": webhook_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"ok": True}


@router.patch("/{webhook_id}")
async def update_webhook(webhook_id: str, active: bool = None, url: str = None, user: dict = Depends(get_current_user)):
    """Update webhook settings."""
    db = get_db()
    updates = {}
    if active is not None:
        updates["active"] = active
    if url is not None:
        if not url.startswith("http"):
            raise HTTPException(status_code=400, detail="Invalid URL")
        updates["url"] = url

    res = await db.webhooks.update_one(
        {"id": webhook_id, "user_id": user["id"]},
        {"$set": updates}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"ok": True}


async def trigger_webhooks(user_id: str, event: str, job_id: str, job_data: dict):
    """Send webhook notifications for job events."""
    import httpx

    db = get_db()
    webhooks = await db.webhooks.find(
        {"user_id": user_id, "active": True, "events": event},
        {"_id": 0}
    ).to_list(None)

    payload = {
        "event": event,
        "job_id": job_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": job_data,
    }

    for webhook in webhooks:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(webhook["url"], json=payload)
        except Exception as exc:
            logger.warning(f"Webhook delivery failed for {webhook['id']}: {exc}")
