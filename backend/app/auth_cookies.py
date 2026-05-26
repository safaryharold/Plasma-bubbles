"""Cookie helpers for access and refresh tokens.

Small helpers to set/clear the httpOnly session cookies used by the frontend.
Cookie behaviour is configurable via environment variables for deployment
flexibility.
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
    """Clear both access and refresh cookies."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")

