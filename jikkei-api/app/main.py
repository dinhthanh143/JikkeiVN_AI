# Jikkei API — production-hardened entrypoint.
import asyncio
import sys
import uuid
from contextlib import asynccontextmanager

# On Windows, psycopg requires SelectorEventLoop, not the default Proactor.
# Set this BEFORE uvicorn initializes asyncio so the event loop is already correct.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import engine, initialize_database
from app.core.exceptions import register_exception_handlers
from app.core.logging_config import setup_logging
from app.tasks.scheduler import init_scheduler, shutdown_scheduler

IS_PRODUCTION = settings.ENVIRONMENT.lower() == "production"

# Logging first ensures all subsequent startup/runtime events are captured in one format.
setup_logging(log_level=settings.LOG_LEVEL, json_logs=IS_PRODUCTION)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and teardown background tasks/resources securely."""
    logger.info("Jikkei API starting up...")
    await initialize_database()
    init_scheduler()
    logger.info("Startup complete")
    
    try:
        yield
    finally:
        logger.info("Jikkei API shutting down...")
        await shutdown_scheduler()
        logger.info("Shutdown complete")


if IS_PRODUCTION and settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        # Sampling protects quota while still giving representative performance signals.
        traces_sample_rate=0.1,
        integrations=[FastApiIntegration(transaction_style="endpoint"), SqlalchemyIntegration()],
        # Keep PII off by default to reduce compliance risk in shared tooling.
        send_default_pii=False,
    )
    logger.info("Sentry initialized for production error tracking")

app = FastAPI(
    title="Jikkei API",
    version="0.1.0",
    # Hide API schema/docs in production to reduce endpoint reconnaissance surface.
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
    lifespan=lifespan,
)

limiter = Limiter(
    key_func=get_remote_address,
    # Defaults to in-memory storage for local dev; set Redis URI in production.
    storage_uri=settings.RATELIMIT_STORAGE_URL,
)
app.state.limiter = limiter


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return a clean JSON 429 response for rate-limit violations."""
    return JSONResponse(
        status_code=429,
        content={
            "error": "RATE_LIMIT_EXCEEDED",
            "detail": str(exc.detail) if getattr(exc, "detail", None) else "Too many requests",
        },
    )


app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach baseline browser security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Deny framing to block clickjacking overlays.
        response.headers["X-Frame-Options"] = "DENY"
        # CSP frame-ancestors is modern defense complementing X-Frame-Options.
        response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
        # Disable MIME sniffing to prevent content-type confusion execution.
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Limit referrer leakage of internal URLs to third-party origins.
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Disable unused powerful APIs to reduce impact if XSS is ever introduced.
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        if IS_PRODUCTION:
            # HSTS only in production because local dev often runs plain HTTP.
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject oversized request bodies early to reduce memory-exhaustion DoS risk."""

    MAX_BODY_SIZE = 1 * 1024 * 1024

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        max_body_size = self.MAX_BODY_SIZE
        if request.url.path == "/api/upload":
            # Multipart adds boundary overhead, so allow a small buffer above binary image cap.
            max_body_size = (settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024) + (256 * 1024)

        if content_length and int(content_length) > max_body_size:
            return JSONResponse(
                status_code=413,
                content={"error": "PAYLOAD_TOO_LARGE", "detail": "Request body exceeds allowed limit"},
            )
        return await call_next(request)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Generate per-request correlation IDs for tracing across logs and clients."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    # Explicit origin allowlist avoids wildcard + credentials security pitfalls.
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

register_exception_handlers(app)

# Import routers only after limiter/app are fully initialized to avoid circular import issues.
from app.routers import ai_chat, billing, credits, game, scene, shop, admin_router, auth_router, upload, users
from app.routers.stream import stream_router

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(scene.router, prefix="/api", tags=["scenes"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(stream_router, prefix="/api", tags=["stream"])
app.include_router(credits.router, prefix="/api", tags=["credits"])
app.include_router(game.router, prefix="/api", tags=["game"])
app.include_router(shop.router, prefix="/api", tags=["shop"])
app.include_router(billing.router, prefix="/api", tags=["billing"])
app.include_router(ai_chat.router, prefix="/api/ai", tags=["ai"])


@app.get("/")
async def root() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


@app.get("/health")
async def health() -> JSONResponse:
    """Return service+database health so orchestrators can route away from degraded instances."""
    db_status = "unhealthy"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        # Full exception details stay in server logs; response remains minimal by design.
        logger.exception("Health check database probe failed")

    status_code = 200 if db_status == "healthy" else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if db_status == "healthy" else "degraded",
            "database": db_status,
            "version": "0.1.0",
        },
    )
