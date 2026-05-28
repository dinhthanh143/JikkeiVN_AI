"""
Shared test fixtures for Jikkei API test suite.

Uses FastAPI's TestClient which runs the full app in-process —
all middleware, dependencies, and exception handlers fire exactly
as they do in production. This catches real integration bugs,
not mocked ones.

Why not mock the DB: Mocking the DB means you're testing the mock,
not the code. We use an in-memory SQLite DB for tests so real
SQL runs without needing a Postgres instance in CI.
"""

import os

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Why set env vars here: app settings are instantiated at import time.
# Defining test-safe defaults before importing app modules makes tests
# hermetic and keeps CI independent from local .env files.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://user:pass@localhost:5432/testdb")
os.environ.setdefault("SECRET_KEY", "test_secret_key_32_characters_minimum_ok")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("REDIS_URL", "memory://")
os.environ.setdefault("RATE_LIMIT_LOGIN", "1000/minute")
os.environ.setdefault("RATE_LIMIT_REGISTER", "1000/minute")
os.environ.setdefault("RATE_LIMIT_REFRESH", "1000/minute")

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models.user import User

# SQLite in-memory DB for tests — no Postgres needed in CI.
# StaticPool keeps one shared connection so the in-memory DB persists
# for the full test session instead of resetting per connection.
SQLITE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
async def engine():
    engine = create_async_engine(
        SQLITE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db(engine):
    SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
def client(db):
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def regular_user(db):
    """A regular user pre-seeded in the test DB."""
    await db.execute(
        delete(User).where(
            (User.email == "player@test.com") | (User.username == "testplayer")
        )
    )
    await db.commit()
    user = User(
        email="player@test.com",
        username="testplayer",
        hashed_password=hash_password("TestPass123!"),
        role="user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db):
    """An admin user pre-seeded in the test DB."""
    await db.execute(
        delete(User).where(
            (User.email == "admin@test.com") | (User.username == "testadmin")
        )
    )
    await db.commit()
    user = User(
        email="admin@test.com",
        username="testadmin",
        hashed_password=hash_password("AdminPass123!"),
        role="admin",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
def user_cookies(client, regular_user):
    """Login as regular user and return auth cookies."""
    resp = client.post(
        "/auth/login",
        json={
            "email": "player@test.com",
            "password": "TestPass123!",
        },
    )
    assert resp.status_code == 200
    return resp.cookies


@pytest.fixture
def admin_cookies(client, admin_user):
    """Login as admin and return auth cookies."""
    resp = client.post(
        "/auth/login",
        json={
            "email": "admin@test.com",
            "password": "AdminPass123!",
        },
    )
    assert resp.status_code == 200
    return resp.cookies
