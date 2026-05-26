"""Middleware for logging and monitoring."""
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("ibp.http")


class LoggingMiddleware(BaseHTTPMiddleware):
    """Log all HTTP requests with timing and status codes."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        path = request.url.path
        method = request.method

        try:
            response = await call_next(request)
        except Exception as exc:
            duration = time.time() - start_time
            logger.error(
                f"{method} {path} - Exception after {duration:.2f}s",
                exc_info=exc
            )
            raise

        duration = time.time() - start_time
        status_code = response.status_code

        # Log with different levels based on status
        level = logging.INFO
        if status_code >= 500:
            level = logging.ERROR
        elif status_code >= 400:
            level = logging.WARNING

        logger.log(
            level,
            f"{method} {path} - {status_code} ({duration:.2f}s)"
        )

        return response
