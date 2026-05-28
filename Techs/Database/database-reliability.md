# Database Reliability and Security Notes

## Connection pool strategy

Current async engine hardening goals:
- Keep enough warm connections for typical concurrent load.
- Allow short bursts without immediate queue starvation.
- Detect stale connections before handing them to application logic.
- Rotate long-lived connections to avoid server-side idle timeout mismatch.

Applied tuning concepts:
- pool_size: baseline persistent open connections.
- max_overflow: temporary extra connections for spikes.
- pool_pre_ping: validates connection health before use.
- pool_recycle: closes/reopens old connections to avoid stale states.

## Security-related schema details

User table tracks:
- failed_login_attempts
- locked_until

Refresh token table tracks:
- token_hash (never raw token)
- token_family
- expiration and revocation fields

Why these fields matter:
- Account lockout is stateful and auditable.
- Token reuse detection needs token family lineage.

## Migration discipline

- Prefer explicit SQL migration scripts or migration tooling.
- Never drop auth tables for routine upgrades.
- Use additive changes with IF NOT EXISTS in production-safe scripts.
- Backfill defaults when adding non-null columns.

## Operational checks

1. /health should include a real DB query, not only process status.
2. Monitor connection errors and pool exhaustion indicators.
3. Keep DB URL scheme consistent with driver (asyncpg for async runtime).
