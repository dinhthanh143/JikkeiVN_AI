# Async SQLAlchemy engine, session factory, and DB dependency wiring.
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

# Shared base class for all SQLAlchemy data models
Base = declarative_base()


def _select_database_url() -> str:
    """Retrieve the primary database connection string from environment settings."""
    return settings.DATABASE_URL


def _create_engine(database_url: str) -> AsyncEngine:
    """
    Configure and instantiate the asynchronous PostgreSQL engine.
    Optimized for high-performance pooling when communicating with Supabase.
    """
    return create_async_engine(
        database_url,
        # Keep a stable pool warm to reduce connection handshake latency on steady traffic.
        pool_size=10,
        # Allow burst capacity during traffic spikes without permanently holding connections.
        max_overflow=20,
        # Pre-ping catches dead/stale connections (e.g., terminated by Supabase idleness) before use.
        pool_pre_ping=True,
        # Recycle connections every 30 minutes to prevent backend idle-timeout drops.
        pool_recycle=1800,
        # SQL echo logs raw queries in dev/staging, but is silenced in production for security.
        echo=settings.ENVIRONMENT.lower() != "production",
    )


# Initialize global engine and sessionmaker instances
_active_database_url = _select_database_url()
engine = _create_engine(_active_database_url)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def initialize_database() -> None:
    """
    Application startup initialization hook.
    Since database schema evolutions are managed externally (via Supabase/Alembic),
    this is a non-blocking operational placeholder.
    """
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI Dependency injection provider yielding isolated, request-scoped sessions.
    Automatically handles transaction cleanup and pool return upon request completion.
    """
    async with AsyncSessionLocal() as session:
        yield session