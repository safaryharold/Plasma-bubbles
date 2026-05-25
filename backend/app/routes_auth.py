import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Response
from .models import RegisterRequest, LoginRequest, UserOut, AuthResponse
from .auth import hash_password, verify_password, create_access_token, get_current_user
from .auth_cookies import set_auth_cookie, clear_auth_cookie
from .db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

# Simple rate limiting (in production, use Redis or proper rate limiter)
auth_attempts: dict = {}


def check_rate_limit(email: str):
    """Raise 429 if a given email has failed auth >=5 times in the last 15 min."""
    now = datetime.now(timezone.utc)
    key = email.lower()
    if key in auth_attempts:
        attempts, last_attempt = auth_attempts[key]
        if now - last_attempt < timedelta(minutes=15) and attempts >= 5:
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
        if now - last_attempt > timedelta(minutes=15):
            # Stale lockout window — start fresh.
            auth_attempts.pop(key, None)


def record_failed_attempt(email: str) -> None:
    """Bump the per-email failed-attempt counter (call only on auth failure)."""
    now = datetime.now(timezone.utc)
    key = email.lower()
    attempts, _ = auth_attempts.get(key, (0, now))
    auth_attempts[key] = (attempts + 1, now)


def clear_attempts(email: str) -> None:
    """Reset the lockout counter on a successful login."""
    auth_attempts.pop(email.lower(), None)


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest, response: Response):
    check_rate_limit(body.email)
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
    # New researchers get a persistent 7d cookie by default — easier onboarding.
    set_auth_cookie(response, token, remember=True)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, response: Response):
    check_rate_limit(body.email)
    db = get_db()
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        record_failed_attempt(body.email)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    clear_attempts(body.email)
    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token, remember=bool(body.remember))
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookie(response)
    return {"ok": True}
