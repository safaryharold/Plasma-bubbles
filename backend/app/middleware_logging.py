"""Request logging middleware — logs method, path, status, latency, user-agent."""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("ibp.requests")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:          # surface unhandled exceptions to the log
            logger.error(
                "UNHANDLED %s %s — %s: %s",
                request.method, request.url.path,
                type(exc).__name__, exc,
            )
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        try:
            from .routes_monitoring import record_latency
            record_latency(elapsed_ms, response.status_code)
        except Exception:
            pass
        logger.info(
            "%s %s %s %.1fms — %s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request.headers.get("user-agent", "-"),
        )
        return response
