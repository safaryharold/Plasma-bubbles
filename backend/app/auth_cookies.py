"""Cookie helpers for access and refresh tokens."""
import os
from starlette.responses import Response

_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() != "false"
_SAME_SITE = os.environ.get("COOKIE_SAMESITE", "lax")


def set_auth_cookie(response: Response, token: str, remember: bool = False):
    """Set the httpOnly access token cookie."""
    max_age = 60 * 60 * 24 * 7 if remember else None   # 7 days if "remember me"
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=_SECURE,
        samesite=_SAME_SITE,
        max_age=max_age,
        path="/",
    )


def set_refresh_cookie(response: Response, token: str):
    """Set the httpOnly refresh token cookie (30-day persistent)."""
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=_SECURE,
        samesite=_SAME_SITE,
        max_age=60 * 60 * 24 * 30,
        path="/api/auth/refresh",   # scoped so it's only sent to the refresh endpoint
    )


def clear_auth_cookie(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth/refresh")
