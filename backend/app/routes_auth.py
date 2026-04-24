import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from .models import RegisterRequest, LoginRequest, UserOut, AuthResponse
from .auth import hash_password, verify_password, create_access_token, get_current_user
from .db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest):
    db = get_db()
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role or "researcher",
        "usage_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], user["email"], user["role"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    db = get_db()
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["id"], user["email"], user["role"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}
