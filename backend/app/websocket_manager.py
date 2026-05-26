"""WebSocket connection manager for real-time job-status broadcasts.

Usage
-----
  manager = ConnectionManager()

  # In the WS endpoint:
  await manager.connect(websocket, user_id)

  # Anywhere a job status changes:
  await manager.broadcast_job(user_id, job_dict)
"""
import json
import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # user_id -> list of active websockets
        self._connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self._connections.setdefault(user_id, []).append(websocket)
        logger.debug("WS connect user=%s  total=%d", user_id, len(self._connections[user_id]))

    def disconnect(self, websocket: WebSocket, user_id: str):
        conns = self._connections.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._connections.pop(user_id, None)
        logger.debug("WS disconnect user=%s", user_id)

    async def broadcast_job(self, user_id: str, job: dict):
        """Send a job-status update to every socket owned by *user_id*."""
        payload = json.dumps({"type": "job_update", "job": job})
        dead: list[WebSocket] = []
        for ws in self._connections.get(user_id, []):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def broadcast_all(self, event: dict):
        """Admin broadcast — send to every connected socket."""
        payload = json.dumps(event)
        for uid, sockets in list(self._connections.items()):
            dead: list[WebSocket] = []
            for ws in sockets:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(ws, uid)


# Singleton — imported wherever job status changes
manager = ConnectionManager()
