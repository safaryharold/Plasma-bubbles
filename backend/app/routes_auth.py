import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Response
from .models import RegisterRequest, LoginRequest, UserOut, AuthResponse
<<<<<<< HEAD
from .auth import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_refresh_token, get_current_user,
)
=======
from .auth import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, get_current_user, get_current_refresh_user,
)
>>>>>>> f4c5339 (Apply requested frontend/backend fixes: error boundary, mobile nav, dark mode, export preset routes, Redis public cache, and auth refresh support)
from .auth_cookies import set_auth_cookie, set_refresh_cookie, clear_auth_cookie
from .auth_rate_limit import check_rate_limit, record_failed_attempt, clear_attempts
from .db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest, response: Response):
    await check_rate_limit(body.email)
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
<<<<<<< HEAD
    token = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookie(response, token, remember=True)
    set_refresh_cookie(response, refresh)
=======
    access_token = create_access_token(user["id"], user["email"], user["role"])
    refresh_token = create_refresh_token(user["id"])
    set_auth_cookie(response, access_token, remember=True)
    set_refresh_cookie(response, refresh_token, remember=True)
>>>>>>> f4c5339 (Apply requested frontend/backend fixes: error boundary, mobile nav, dark mode, export preset routes, Redis public cache, and auth refresh support)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, response: Response):
    await check_rate_limit(body.email)
    db = get_db()
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await record_failed_attempt(body.email)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await clear_attempts(body.email)
<<<<<<< HEAD
    token = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookie(response, token, remember=bool(body.remember))
    set_refresh_cookie(response, refresh)
=======
    access_token = create_access_token(user["id"], user["email"], user["role"])
    refresh_token = create_refresh_token(user["id"])
    set_auth_cookie(response, access_token, remember=bool(body.remember))
    set_refresh_cookie(response, refresh_token, remember=bool(body.remember))
>>>>>>> f4c5339 (Apply requested frontend/backend fixes: error boundary, mobile nav, dark mode, export preset routes, Redis public cache, and auth refresh support)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "access_token": access_token, "token_type": "bearer"}


# NOTE: refresh by cookie is handled by the dependency `get_current_refresh_user`
# below (avoids duplicate routes and centralises refresh validation).


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookie(response)
    return {"ok": True}


@router.post("/refresh", response_model=AuthResponse)
async def refresh(response: Response, user: dict = Depends(get_current_refresh_user)):
    """Issue a fresh access + refresh token pair when the refresh cookie is valid."""
    access_token = create_access_token(user["id"], user["email"], user["role"])
    refresh_token = create_refresh_token(user["id"])
    set_auth_cookie(response, access_token, remember=True)
    set_refresh_cookie(response, refresh_token, remember=True)
    safe = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return {"user": safe, "access_token": access_token, "token_type": "bearer"}
