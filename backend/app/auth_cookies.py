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

# Persistent (remember-me) cookie lifetime — 7 days
REMEMBER_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

# In dev preview both FE and BE share the same origin, so Lax + secure works.
COOKIE_SECURE = os.environ.get("AUTH_COOKIE_SECURE", "true").lower() != "false"
COOKIE_SAMESITE = os.environ.get("AUTH_COOKIE_SAMESITE", "lax")


def set_auth_cookie(response: Response, token: str, remember: bool = False) -> None:
    """Set the JWT as an httpOnly cookie.

    When `remember=False` (default), Max-Age is omitted so the cookie behaves
    as a *session cookie* — it is deleted when the browser closes. When
    `remember=True`, the cookie persists for 7 days even across browser
    restarts.
    """
    kwargs = {
        "key": "access_token",
        "value": token,
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "path": "/",
    }
    if remember:
        kwargs["max_age"] = REMEMBER_COOKIE_MAX_AGE
    response.set_cookie(**kwargs)


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/")
