import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from .models import ExperimentCreate, ExperimentOut
from .auth import get_current_user
from .db import get_db
from . import ibp_service

router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.post("", response_model=ExperimentOut)
async def create(body: ExperimentCreate, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": body.name,
        "description": body.description,
        "params": body.params,
        "config_hash": ibp_service.config_hash(body.params),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db = get_db()
    await db.experiments.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@router.get("", response_model=list[ExperimentOut])
async def list_mine(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = await db.experiments.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@router.delete("/{exp_id}")
async def delete(exp_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    q = {"id": exp_id} if user["role"] == "admin" else {"id": exp_id, "user_id": user["id"]}
    res = await db.experiments.delete_one(q)
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return {"ok": True}


@router.post("/{exp_id}/clone", response_model=ExperimentOut)
async def clone(exp_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    src = await db.experiments.find_one({"id": exp_id}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Experiment not found")
    clone_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": src["name"] + " (clone)",
        "description": src.get("description"),
        "params": src["params"],
        "config_hash": src["config_hash"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.experiments.insert_one(clone_doc.copy())
    clone_doc.pop("_id", None)
    return clone_doc
