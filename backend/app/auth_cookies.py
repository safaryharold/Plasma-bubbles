"""Shared helpers for auth route handlers.

Sets/clears the `access_token` httpOnly cookie so the SPA does not need to
persist the JWT in `localStorage` (which is vulnerable to XSS exfiltration).
The backend continues to also return the token in the response body, so
programmatic clients (CI/CD tests, CLIs) using `Authorization: Bearer …`
continue to work unchanged.
"""
from __future__ import annotations
import os
from fastapi import Response

# 24h matches ACCESS_TOKEN_TTL_MIN in app/auth.py
ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24

# In dev preview both FE and BE share the same origin, so Lax + secure works.
COOKIE_SECURE = os.environ.get("AUTH_COOKIE_SECURE", "true").lower() != "false"
COOKIE_SAMESITE = os.environ.get("AUTH_COOKIE_SAMESITE", "lax")


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        max_age=ACCESS_COOKIE_MAX_AGE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/")
