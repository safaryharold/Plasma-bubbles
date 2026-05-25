"""Share-link endpoints for public scenario comparisons.

Creating a share link for a Compare result lets anyone with the link view the
A vs B heatmaps without authenticating. Token is 22 random chars (~128 bits).
"""
import uuid
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from .auth import get_current_user
from .db import get_db

router = APIRouter(prefix="/share", tags=["share"])


def _build_share_payload(a: dict, b: dict) -> dict:
    """Compose the public-share payload from two completed jobs."""
    import numpy as np
    A = np.array(a["result"]["matrix"])
    B = np.array(b["result"]["matrix"])
    return {
        "lons": a["result"]["lons"],
        "lts": a["result"]["lts"],
        "matrix_a": a["result"]["matrix"],
        "matrix_b": b["result"]["matrix"],
        "diff": (A - B).tolist(),
        "params_a": a["params"],
        "params_b": b["params"],
        "summary_a": a.get("summary"),
        "summary_b": b.get("summary"),
        "config_hash_a": a.get("config_hash"),
        "config_hash_b": b.get("config_hash"),
        "stats": {
            "max_abs_diff": float(np.max(np.abs(A - B))),
            "mean_abs_diff": float(np.mean(np.abs(A - B))),
        },
    }


async def _load_share_jobs(db, job_a: str, job_b: str, user: dict) -> tuple[dict, dict]:
    a = await db.ibp_jobs.find_one({"id": job_a}, {"_id": 0})
    b = await db.ibp_jobs.find_one({"id": job_b}, {"_id": 0})
    if not a or not b:
        raise HTTPException(status_code=404, detail="One or both jobs missing")
    if user["role"] != "admin":
        if a["user_id"] != user["id"] or b["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="You can only share your own jobs")
    if a["status"] != "COMPLETED" or b["status"] != "COMPLETED":
        raise HTTPException(status_code=409, detail="Both jobs must be COMPLETED")
    if a["result"]["lons"] != b["result"]["lons"] or a["result"]["lts"] != b["result"]["lts"]:
        raise HTTPException(status_code=400, detail="Jobs must share the same grid")
    return a, b


@router.post("/compare")
async def create_compare_share(payload: dict, user: dict = Depends(get_current_user)):
    """Create a public share link for an A vs B diff."""
    job_a = payload.get("job_a"); job_b = payload.get("job_b")
    title = (payload.get("title") or "Scenario comparison")[:120]
    if not job_a or not job_b:
        raise HTTPException(status_code=400, detail="job_a and job_b required")
    db = get_db()
    a, b = await _load_share_jobs(db, job_a, job_b, user)
    token = secrets.token_urlsafe(16)
    doc = {
        "id": str(uuid.uuid4()),
        "token": token,
        "user_id": user["id"],
        "owner_name": user.get("name"),
        "title": title,
        "kind": "compare",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "view_count": 0,
        "payload": _build_share_payload(a, b),
    }
    await db.shares.insert_one(doc.copy())
    return {"id": doc["id"], "token": token, "title": title, "created_at": doc["created_at"]}


@router.get("/mine")
async def list_mine(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = await db.shares.find({"user_id": user["id"]},
                                {"_id": 0, "payload": 0}).sort("created_at", -1).to_list(100)
    return docs


@router.delete("/{share_id}")
async def revoke(share_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    q = {"id": share_id} if user["role"] == "admin" else {"id": share_id, "user_id": user["id"]}
    res = await db.shares.delete_one(q)
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Share not found")
    return {"ok": True}


# --- PUBLIC endpoint (no auth) ---
public_router = APIRouter(prefix="/public", tags=["public"])


@public_router.get("/share/{token}")
async def get_shared(token: str):
    db = get_db()
    doc = await db.shares.find_one({"token": token}, {"_id": 0, "user_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Share not found")
    await db.shares.update_one({"token": token}, {"$inc": {"view_count": 1}})
    return doc
