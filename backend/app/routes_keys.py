import uuid
import secrets
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from .models import ApiKeyCreate, ApiKeyOut, ApiKeyCreated
from .auth import get_current_user
from .db import get_db

router = APIRouter(prefix="/keys", tags=["api-keys"])


@router.post("", response_model=ApiKeyCreated)
async def create(body: ApiKeyCreate, user: dict = Depends(get_current_user)):
    raw = "ibp_" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": body.name,
        "key_prefix": raw[:12],
        "key_hash": key_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used": None,
        "call_count": 0,
        "revoked": False,
    }
    db = get_db()
    await db.api_keys.insert_one(doc.copy())
    out = {k: v for k, v in doc.items() if k not in ("_id", "key_hash", "user_id")}
    out["raw_key"] = raw
    return out


@router.get("", response_model=list[ApiKeyOut])
async def list_mine(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = await db.api_keys.find({"user_id": user["id"]}, {"_id": 0, "key_hash": 0, "user_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@router.post("/{key_id}/revoke")
async def revoke(key_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    q = {"id": key_id} if user["role"] == "admin" else {"id": key_id, "user_id": user["id"]}
    res = await db.api_keys.update_one(q, {"$set": {"revoked": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"ok": True}
