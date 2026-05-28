# Runtime and Deployment Model

## Environment split

Development mode:
- Uvicorn with reload for fast iteration.
- Human-readable logs.
- Local .env usage.

Production mode:
- Gunicorn process manager running Uvicorn workers.
- JSON structured logs for aggregation/search.
- Optional Sentry telemetry if DSN is configured.
- API docs endpoints disabled.

## Why Gunicorn in production

- Multiple workers improve throughput and isolate crashes.
- Worker restart behavior reduces full-service outage risk.
- max_requests and jitter help mitigate slow memory growth.

## Security middleware expectations

Response should include:
- X-Frame-Options: DENY
- Content-Security-Policy frame-ancestors none
- X-Content-Type-Options: nosniff
- Referrer-Policy strict-origin-when-cross-origin
- Permissions-Policy restrictions
- X-Request-ID correlation ID

Request guardrails:
- Request body size limit for auth routes and generic API paths.
- CORS restricted to configured frontend origin.

## Health checks

- /health should query database connectivity in real time.
- Degraded response should surface quickly for orchestrator routing decisions.

## Secrets and config controls

Required to secure production:
- DATABASE_URL with async driver scheme.
- SECRET_KEY strong random value.
- ENVIRONMENT set to production.
- REDIS_URL set to managed Redis endpoint.
- LOG_LEVEL tuned for observability-noise balance.
- SENTRY_DSN set only when telemetry is explicitly enabled.

Fail-fast startup policy:
- App startup intentionally aborts when SECRET_KEY is weak/placeholder.
- In production, startup also aborts when DATABASE_URL is not PostgreSQL.
- Why this is intentional: a misconfigured app must fail loudly at boot rather than serve compromised traffic.
