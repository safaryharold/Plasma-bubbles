"""IBP computation endpoints: single, batch sweep, jobs, downloads, compare."""
import os
import io
import uuid
import csv
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Response
from fastapi.responses import StreamingResponse
from .models import IBPCalculateRequest, IBPCalculateResult, IBPBatchRequest, JobOut
from .auth import get_current_user
from .db import get_db
from . import ibp_service, rate_limit

router = APIRouter(prefix="/ibp", tags=["ibp"])

GRID_CAP = int(os.environ.get("IBP_GRID_CAP", "10000"))


@router.get("/meta")
async def meta():
    return {
        "model_source": ibp_service.MODEL_SOURCE,
        "grid_cap": GRID_CAP,
        "inputs": {
            "day_month": "1-12 = calendar month; 13-366 = day-of-year",
            "lon": "longitude in degrees, -180 .. 180",
            "lt": "local time in hours, 0 .. 24",
            "f107": "10.7 cm solar flux index, 60 .. 300",
        },
    }


@router.post("/calculate", response_model=IBPCalculateResult)
async def calculate(body: IBPCalculateRequest, user: dict = Depends(get_current_user)):
    rate_limit.check(user)
    df = ibp_service.calculate(body.day_month, [body.lon], [body.lt], body.f107)
    row = df.iloc[0]
    ibp = float(row["IBP"])
    lt = float(row["LT"])
    doy = int(row["Doy"])
    result = IBPCalculateResult(
        doy=doy,
        month=int(row["Month"]),
        lon=float(row["Lon"]),
        lt=lt,
        f107=float(row["F10.7"]),
        ibp=ibp,
        confidence=ibp_service.confidence_for(ibp, lt),
        anomaly_flag=ibp_service.anomaly_flag(ibp, lt),
        explanation=ibp_service.explain(ibp, lt, float(row["Lon"]), float(row["F10.7"]), doy),
    )
    db = get_db()
    await db.users.update_one({"id": user["id"]}, {"$inc": {"usage_count": 1}})
    return result


async def _run_batch_job(job_id: str, params: dict):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    await db.ibp_jobs.update_one({"id": job_id}, {"$set": {"status": "RUNNING", "started_at": now}})
    try:
        lons, lts = ibp_service.compute_grid(params)
        df = ibp_service.calculate(params["day_month"], lons, lts, params["f107"])
        # Store compact grid form for viz & CSV
        grid = {}
        for _, row in df.iterrows():
            grid.setdefault(float(row["Lon"]), {})[float(row["LT"])] = float(row["IBP"])
        summary = {
            "count": int(len(df)),
            "ibp_min": float(df["IBP"].min()),
            "ibp_max": float(df["IBP"].max()),
            "ibp_mean": float(df["IBP"].mean()),
            "ibp_p95": float(df["IBP"].quantile(0.95)),
            "hotspots": df.nlargest(5, "IBP")[["Lon", "LT", "IBP"]].to_dict(orient="records"),
        }
        result_doc = {
            "lons": lons,
            "lts": lts,
            "matrix": [[grid.get(ln, {}).get(t, 0.0) for t in lts] for ln in lons],
            "doy": int(df.iloc[0]["Doy"]),
            "month": int(df.iloc[0]["Month"]),
        }
        await db.ibp_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "COMPLETED",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "summary": summary,
                "result": result_doc,
            }},
        )
    except Exception as exc:
        await db.ibp_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "FAILED", "error": str(exc),
                      "completed_at": datetime.now(timezone.utc).isoformat()}},
        )


@router.post("/batch", response_model=JobOut)
async def batch(body: IBPBatchRequest, background: BackgroundTasks, user: dict = Depends(get_current_user)):
    rate_limit.check(user)
    params = body.model_dump()
    lons, lts = ibp_service.compute_grid(params)
    cells = len(lons) * len(lts)
    if cells == 0:
        raise HTTPException(status_code=400, detail="Grid is empty; widen lon/lt range or reduce step")
    if cells > GRID_CAP:
        raise HTTPException(status_code=400, detail=f"Grid {cells} exceeds cap {GRID_CAP}")
    job = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "sweep",
        "name": body.name,
        "status": "PENDING",
        "params": params,
        "config_hash": ibp_service.config_hash(params),
        "cells": cells,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "started_at": None,
        "completed_at": None,
        "error": None,
        "summary": None,
    }
    db = get_db()
    await db.ibp_jobs.insert_one(job.copy())
    background.add_task(_run_batch_job, job["id"], params)
    job.pop("_id", None)
    return job


@router.get("/jobs", response_model=list[JobOut])
async def list_jobs(user: dict = Depends(get_current_user)):
    db = get_db()
    q = {} if user["role"] == "admin" else {"user_id": user["id"]}
    docs = await db.ibp_jobs.find(q, {"_id": 0, "result": 0}).sort("created_at", -1).to_list(200)
    return docs


@router.get("/job/{job_id}", response_model=JobOut)
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    job = await db.ibp_jobs.find_one({"id": job_id}, {"_id": 0, "result": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user["role"] != "admin" and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return job


@router.get("/visualization-data/{job_id}")
async def viz(job_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    job = await db.ibp_jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user["role"] != "admin" and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if job["status"] != "COMPLETED":
        raise HTTPException(status_code=409, detail=f"Job status is {job['status']}")
    res = job["result"]
    return {
        "job_id": job_id,
        "config_hash": job["config_hash"],
        "params": job["params"],
        "lons": res["lons"],
        "lts": res["lts"],
        "matrix": res["matrix"],
        "doy": res["doy"],
        "month": res["month"],
        "summary": job["summary"],
    }


@router.get("/download/{job_id}")
async def download_csv(job_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    job = await db.ibp_jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user["role"] != "admin" and job["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if job["status"] != "COMPLETED":
        raise HTTPException(status_code=409, detail=f"Job status is {job['status']}")
    res = job["result"]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Doy", "Month", "Lon", "LT", "F10.7", "IBP"])
    f107 = job["params"]["f107"]
    for i, ln in enumerate(res["lons"]):
        for j, t in enumerate(res["lts"]):
            w.writerow([res["doy"], res["month"], ln, t, f107, res["matrix"][i][j]])
    buf.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="ibp_job_{job_id[:8]}.csv"'}
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers=headers)


@router.post("/compare")
async def compare(payload: dict, user: dict = Depends(get_current_user)):
    """Compare two completed jobs A vs B. Returns diff matrix (A-B)."""
    a_id = payload.get("job_a")
    b_id = payload.get("job_b")
    if not a_id or not b_id:
        raise HTTPException(status_code=400, detail="job_a and job_b required")
    db = get_db()
    a = await db.ibp_jobs.find_one({"id": a_id}, {"_id": 0})
    b = await db.ibp_jobs.find_one({"id": b_id}, {"_id": 0})
    if not a or not b:
        raise HTTPException(status_code=404, detail="One or both jobs missing")
    if user["role"] != "admin":
        if a["user_id"] != user["id"] or b["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Forbidden")
    if a["status"] != "COMPLETED" or b["status"] != "COMPLETED":
        raise HTTPException(status_code=409, detail="Both jobs must be COMPLETED")
    if a["result"]["lons"] != b["result"]["lons"] or a["result"]["lts"] != b["result"]["lts"]:
        raise HTTPException(status_code=400, detail="Jobs must share the same lon/lt grid for diff")
    import numpy as np
    A = np.array(a["result"]["matrix"])
    B = np.array(b["result"]["matrix"])
    D = (A - B).tolist()
    return {
        "job_a": {"id": a_id, "params": a["params"], "matrix": a["result"]["matrix"], "summary": a["summary"]},
        "job_b": {"id": b_id, "params": b["params"], "matrix": b["result"]["matrix"], "summary": b["summary"]},
        "diff": D,
        "lons": a["result"]["lons"],
        "lts": a["result"]["lts"],
        "stats": {
            "max_abs_diff": float(np.max(np.abs(A - B))),
            "mean_abs_diff": float(np.mean(np.abs(A - B))),
        },
    }


@router.get("/usage")
async def usage(user: dict = Depends(get_current_user)):
    return rate_limit.usage(user)
