import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from .models import ExperimentCreate, ExperimentOut, ExportPresetCreate, ExportPresetOut
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


# --- Export Presets ---
@router.post("/{exp_id}/export-preset", response_model=ExportPresetOut)
async def save_export_preset(exp_id: str, payload: ExportPresetCreate, user: dict = Depends(get_current_user)):
    """Save an export preset (configuration for downloading results in different formats)."""
    db = get_db()
    exp = await db.experiments.find_one({"id": exp_id, "user_id": user["id"]}, {"_id": 0})
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")

    preset_id = str(uuid.uuid4())
    preset = {
        "id": preset_id,
        "exp_id": exp_id,
        "user_id": user["id"],
        "format": payload.format,
        "settings": payload.settings,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.export_presets.insert_one(preset)
    return preset


@router.get("/{exp_id}/export-presets", response_model=list[ExportPresetOut])
async def list_export_presets(exp_id: str, user: dict = Depends(get_current_user)):
    """List all export presets for an experiment."""
    db = get_db()
    presets = await db.export_presets.find(
        {"exp_id": exp_id, "user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return presets


@router.delete("/export-preset/{preset_id}")
async def delete_export_preset(preset_id: str, user: dict = Depends(get_current_user)):
    """Delete an export preset."""
    db = get_db()
    res = await db.export_presets.delete_one({"id": preset_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"ok": True}
