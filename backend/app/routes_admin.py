from fastapi import APIRouter, HTTPException, Depends
from .auth import require_role
from .db import get_db

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
async def list_users(_: dict = Depends(require_role("admin"))):
    db = get_db()
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)


@router.post("/users/{user_id}/role")
async def set_role(user_id: str, payload: dict, _: dict = Depends(require_role("admin"))):
    new_role = payload.get("role")
    if new_role not in ("researcher", "pro", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    db = get_db()
    res = await db.users.update_one({"id": user_id}, {"$set": {"role": new_role}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@router.get("/stats")
async def stats(_: dict = Depends(require_role("admin"))):
    db = get_db()
    return {
        "users": await db.users.count_documents({}),
        "jobs_total": await db.ibp_jobs.count_documents({}),
        "jobs_completed": await db.ibp_jobs.count_documents({"status": "COMPLETED"}),
        "jobs_failed": await db.ibp_jobs.count_documents({"status": "FAILED"}),
        "experiments": await db.experiments.count_documents({}),
        "api_keys": await db.api_keys.count_documents({}),
    }
