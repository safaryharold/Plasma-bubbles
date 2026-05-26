"""Cookie helpers for access and refresh tokens.

Provides small helpers to set/clear the httpOnly session cookies used by
the frontend. Values are intentionally conservative and read from env when
available so deployments can override secure/samesite behaviour.
"""
import os
from starlette.responses import Response

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() != "false"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax")
REMEMBER_COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def set_auth_cookie(response: Response, token: str, remember: bool = False) -> None:
    """Set the access JWT as an httpOnly cookie."""
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


def set_refresh_cookie(response: Response, token: str, remember: bool = False) -> None:
    """Set the refresh JWT as an httpOnly cookie (persistent when requested)."""
    kwargs = {
        "key": "refresh_token",
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
    response.delete_cookie(key="refresh_token", path="/")
>>>>>>> f4c5339 (Apply requested frontend/backend fixes: error boundary, mobile nav, dark mode, export preset routes, Redis public cache, and auth refresh support)
def set_auth_cookie(response: Response, token: str, remember: bool = False) -> None:
    """Set the access JWT as an httpOnly cookie."""
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


def set_refresh_cookie(response: Response, token: str, remember: bool = False) -> None:
    """Set the refresh JWT as an httpOnly cookie."""
    kwargs = {
        "key": "refresh_token",
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
    response.delete_cookie(key="refresh_token", path="/")
>>>>>>> f4c5339 (Apply requested frontend/backend fixes: error boundary, mobile nav, dark mode, export preset routes, Redis public cache, and auth refresh support)
