"""JWT + bcrypt authentication helpers."""
import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, Depends
from .db import get_db

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_MIN = 60 * 24  # 24h for research sessions


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_TTL_MIN),
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("access_token")


async def get_current_user(request: Request) -> dict:
    # API key path: allow x-api-key header for programmatic access
    api_key = request.headers.get("x-api-key")
    if api_key:
        return await _user_from_api_key(api_key)

    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    db = get_db()
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def _user_from_api_key(raw_key: str) -> dict:
    import hashlib
    db = get_db()
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    record = await db.api_keys.find_one({"key_hash": key_hash, "revoked": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=401, detail="Invalid API key")
    user = await db.users.find_one({"id": record["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="API key user missing")
    await db.api_keys.update_one(
        {"id": record["id"]},
        {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}, "$inc": {"call_count": 1}},
    )
    return user


def require_role(*allowed_roles: str):
    async def _guard(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {', '.join(allowed_roles)}")
        return user
    return _guard


async def seed_admin():
    db = get_db()
    email = os.environ.get("ADMIN_EMAIL", "admin@ibp.dev").lower()
    password = os.environ.get("ADMIN_PASSWORD", "admin123")
    # Production safety warning — log loudly if the legacy weak password leaks
    # into a deploy. The bootstrap admin bypasses the field_validator only
    # because it's seeded directly; this banner is the audit trail.
    if password in ("admin123", "password", "changeme"):
        import logging
        logging.getLogger("ibp").warning(
            "ADMIN_PASSWORD looks weak (%s). Set a strong value in env before "
            "promoting this build to production. See /app/memory/test_credentials.md.",
            "***" + password[-2:],
        )
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(password),
            "name": "Platform Admin",
            "role": "admin",
            "usage_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": hash_password(password), "role": "admin"}},
        )


# ── Refresh token support ─────────────────────────────────────────────────────

REFRESH_TOKEN_TTL_DAYS = 30


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_TTL_DAYS),
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": str(uuid.uuid4()),   # unique ID so we can invalidate individual tokens
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload
