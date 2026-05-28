# Libraries

This file explains the main backend libraries currently used in the project, what problem each solves, and what operational/security tradeoffs matter.

## Core API and Runtime

| Library | Role | Why it is used | Key notes |
|---|---|---|---|
| fastapi | API framework | Fast async APIs with typed schemas | Keep framework and Starlette versions aligned to avoid security drift |
| uvicorn | ASGI server (dev) | Fast local development server | Use with reload only in development |
| gunicorn | Process manager (prod) | Multi-worker production serving and worker restart | Mitigates single-process downtime and improves throughput |

## Database and Migrations

| Library | Role | Why it is used | Key notes |
|---|---|---|---|
| sqlalchemy | ORM + query builder | Parameterized DB access and model layer | Helps reduce SQL injection risk by design |
| asyncpg | Async PostgreSQL driver | Efficient async DB I/O | Requires async URL scheme and matching engine config |
| psycopg2-binary | Sync PostgreSQL driver | Utility scripts and compatibility tasks | Used for one-off admin/bootstrap scripts |
| alembic | Migration tooling | Schema change tracking and rollout | Prefer explicit migrations over ad-hoc schema edits |

## Auth and Security

| Library | Role | Why it is used | Key notes |
|---|---|---|---|
| python-jose | JWT encode/decode | Access token signing and verification | Monitor advisories and plan upgrades quickly |
| passlib | Password hashing API | Unified bcrypt hash/verify operations | Keep bcrypt versions compatible with passlib |
| bcrypt | Password hash algorithm | Slow hash to resist brute force | Input length and version compatibility matter |
| slowapi | Rate limiting | Route-level request throttling | Uses Redis backend for distributed correctness |
| limits | Rate-limit engine | Backend dependency for slowapi | Keep in sync with slowapi support matrix |
| redis | Counter store | Shared state for rate limits/counters | Required for multi-instance correctness |
| sentry-sdk[fastapi] | Error tracking | Production crash reporting and tracing | Leave disabled until DSN is configured in production |

## Logging and Ops

| Library | Role | Why it is used | Key notes |
|---|---|---|---|
| loguru | Application logging | Simpler structured logging setup | Supports JSON output for log aggregation |
| python-json-logger | JSON log formatting utility | Compatibility with log processors | Useful for standardized log pipelines |

## Validation and Utility

| Library | Role | Why it is used | Key notes |
|---|---|---|---|
| pydantic-settings | Config loading/validation | Strict env config parsing | Prevents startup with missing critical settings |
| email-validator | Email validation backend | Required for EmailStr correctness | Rejects malformed addresses early |
| python-dotenv | Local env loading | Development convenience | Never commit real secrets |
| python-multipart | Form/multipart parsing | Needed by request handling for multipart payloads | Track CVEs; upgrade when patched versions are available |
| httpx | HTTP client | Outbound API calls from backend | Prefer explicit timeout and retry strategy per call path |
| pytest | Test runner | Backend integration and security regression suite | CI executes security-focused tests before merge |
| pytest-asyncio | Async test support | Async fixtures for SQLAlchemy and startup wiring | Required for async DB/session fixtures |
| aiosqlite | Async SQLite driver | In-memory DB backend for CI-friendly integration tests | Avoids DB mocks while keeping tests deterministic |

## Security tooling

| Tool | Role | Why it is used |
|---|---|---|
| bandit | Static security linting | Detects insecure code patterns in Python source |
| pip-audit | Dependency vulnerability scan | Detects known CVEs/advisories in installed/pinned packages |

## Dependency risk notes from recent audit

Latest notable findings (from pip-audit run):
- python-jose 3.3.0 has known advisories; fixed in 3.4.0.
- python-multipart 0.0.12 has known CVEs; fixed versions available.
- starlette 0.38.6 has known CVEs; upgrade path tied to FastAPI compatibility.

Immediate strategy:
1. Upgrade directly where compatibility is low-risk (for example python-jose and python-multipart).
2. Plan framework pair upgrades (FastAPI + Starlette) together, not independently.
3. Keep CI scans active so newly disclosed vulnerabilities are visible quickly.
