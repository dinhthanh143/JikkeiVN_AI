# Security Posture

This document captures practical security controls currently implemented and the reasoning behind them.

## Threat model focus

Primary risks addressed right now:
- Credential attacks (brute force, password spray attempts)
- Session hijack/token replay
- API misuse and reconnaissance
- Input abuse and app-layer denial-of-service
- Error information leakage

## Controls currently implemented

- SQL injection resistance
  - SQLAlchemy ORM/query builder uses parameterized execution paths.

- Token exposure reduction
  - Access/refresh tokens are in httpOnly cookies so browser JavaScript cannot read them.

- Basic CSRF reduction
  - SameSite=lax applied to auth cookies.

- Brute-force protection
  - Route-level rate limiting per IP plus account lockout after repeated failures.

- Replay/theft detection for refresh tokens
  - Token family model with reuse detection invalidates whole family on revoked-token replay.

- Timing-attack mitigation on login
  - Dummy hash verification runs even when user does not exist to reduce enumeration signal.

- Clickjacking protection
  - X-Frame-Options DENY and CSP frame-ancestors none.

- Request-size guard
  - Body size limit middleware rejects oversized payloads to reduce memory-pressure abuse.

- Error response hardening
  - Central exception layer returns consistent safe client messages while logging server detail.

- Fail-fast startup configuration validation
  - App refuses to boot with weak or placeholder SECRET_KEY values.
  - Production mode requires PostgreSQL DATABASE_URL format.
  - Why this matters: misconfiguration is treated as a blocking safety failure, not a runtime warning.

- Response data minimization by context
  - Public auth responses omit security internals.
  - /auth/me includes self email but excludes account-security counters.
  - Admin routes include operational security metadata needed for account management.

- BOLA prevention foundation
  - Shared ownership assertion utility exists for future resource routes.
  - Pattern enforces owner-or-admin checks and logs cross-owner access attempts.

- Connection reliability hardening
  - pool_pre_ping and recycle strategy reduce stale-connection failures under idle churn.

- Worker stability hardening
  - Gunicorn worker recycling limits memory drift over long uptime.

## Partial coverage and gaps

- Password spray across many IPs
  - Current controls are primarily per-IP; global attempt counters are not yet active.

- Dependency exposure window
  - CI scan exists, but patching cadence and compatibility rollout still need process discipline.

- Infra-layer DDoS
  - Full volumetric filtering requires edge provider or upstream infrastructure not yet in place.

## Operational checklist

Before production launch:
1. Configure Redis as managed service (not localhost).
2. Set strong SECRET_KEY and production cookie security settings.
3. Configure SENTRY_DSN for crash visibility.
4. Confirm docs endpoints are disabled in production environment.
5. Validate security headers via integration check.
6. Run bandit and pip-audit in CI and block deploy on policy-defined severities.
7. Run pytest security suite for auth/access-control regressions.

After launch:
1. Monitor repeated 401/429 patterns.
2. Add global login rate counter.
3. Add edge protection (Cloudflare or equivalent).
4. Maintain monthly dependency patch review.
