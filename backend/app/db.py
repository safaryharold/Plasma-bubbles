"""Single MongoDB client instance shared across routers."""
from __future__ import annotations
import os
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient

# Initialised unconditionally so every code path that references `_client`
# (with `global _client`) can rely on it being defined.
_client: Optional[AsyncIOMotorClient] = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return _client


def get_db():
    return get_client()[os.environ["DB_NAME"]]
