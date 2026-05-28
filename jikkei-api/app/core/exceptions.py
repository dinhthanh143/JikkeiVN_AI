"""
Centralized exception hierarchy for Jikkei API.

Why: Without this, unhandled errors can return framework-default 500
payloads that reveal implementation details useful to attackers.
All exceptions funnel through safe, consistent JSON responses while
full traceback details stay in server logs only.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class JikkeiException(Exception):
    """Base domain exception so handlers can format all business errors consistently."""

    def __init__(self, message: str, status_code: int = 400, error_code: str = "ERROR"):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(message)


class NotFoundError(JikkeiException):
    def __init__(self, resource: str):
        super().__init__(f"{resource} not found", status_code=404, error_code="NOT_FOUND")


class UnauthorizedError(JikkeiException):
    def __init__(self, detail: str = "Unauthorized"):
        super().__init__(detail, status_code=401, error_code="UNAUTHORIZED")


class ForbiddenError(JikkeiException):
    def __init__(self):
        super().__init__("Forbidden", status_code=403, error_code="FORBIDDEN")


class RateLimitError(JikkeiException):
    def __init__(self, detail: str = "Too many requests"):
        super().__init__(detail, status_code=429, error_code="RATE_LIMITED")


def register_exception_handlers(app: FastAPI) -> None:
    """Register global handlers once at startup to keep all error shapes predictable."""

    @app.exception_handler(JikkeiException)
    async def jikkei_exception_handler(request: Request, exc: JikkeiException) -> JSONResponse:
        # Request ID links user-reported errors to exact server-side log events.
        logger.warning(
            "Domain exception: %s | path=%s | request_id=%s",
            exc.message,
            request.url.path,
            getattr(request.state, "request_id", "-"),
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.error_code, "detail": exc.message},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Return field-level errors but never echo raw submitted values (can include secrets).
        errors = [
            {"field": ".".join(str(loc) for loc in err["loc"]), "message": err["msg"]}
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={"error": "VALIDATION_ERROR", "detail": errors},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        # Full traceback remains server-side; client only gets a generic message.
        logger.exception(
            "Unhandled exception | path=%s | request_id=%s",
            request.url.path,
            getattr(request.state, "request_id", "-"),
        )
        return JSONResponse(
            status_code=500,
            content={"error": "INTERNAL_ERROR", "detail": "An unexpected error occurred"},
        )
