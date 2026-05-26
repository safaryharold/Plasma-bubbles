"""WebSocket endpoint — /api/ws/jobs

Clients connect with their httpOnly cookie (credentials: 'include').
The server authenticates via /auth/me logic, then keeps the socket open
and pushes job-status updates whenever a batch job changes state.

Front-end usage:
  const ws = new WebSocket(`${WS_BASE}/api/ws/jobs`);
  ws.onmessage = (e) => {
    const { type, job } = JSON.parse(e.data);
    if (type === 'job_update') updateJobInState(job);
  };
"""
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Cookie, Query
from .auth import decode_token
from .db import get_db
from .websocket_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


async def _authenticate_ws(token: str | None) -> dict | None:
    """Return user dict if token is valid, else None."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        db = get_db()
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        return user
    except Exception:
        return None


@router.websocket("/ws/jobs")
async def jobs_ws(
    websocket: WebSocket,
    access_token: str | None = Cookie(default=None),
    token: str | None = Query(default=None),   # fallback for clients that can't set cookies
):
    """Real-time job-status stream for the authenticated user."""
    # Accept auth from cookie OR ?token= query param
    raw_token = access_token or token
    user = await _authenticate_ws(raw_token)
    if not user:
        await websocket.close(code=4401, reason="Unauthorized")
        return

    await manager.connect(websocket, user["id"])
    logger.info("WS opened for user=%s", user["id"])

    try:
        # Send initial snapshot of pending/running jobs
        db = get_db()
        active = await db.ibp_jobs.find(
            {"user_id": user["id"], "status": {"$in": ["PENDING", "RUNNING"]}},
            {"_id": 0, "result": 0},
        ).to_list(50)
        for job in active:
            await manager.broadcast_job(user["id"], job)

        # Keep connection alive with periodic pings
        while True:
            await asyncio.sleep(30)
            await websocket.send_text('{"type":"ping"}')
    except WebSocketDisconnect:
        logger.info("WS closed for user=%s", user["id"])
    finally:
        manager.disconnect(websocket, user["id"])
