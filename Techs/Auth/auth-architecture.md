# Auth Architecture

This file documents current authentication mechanics and security logic.

## Model overview

Session design:
- Access token: short-lived JWT in httpOnly cookie.
- Refresh token: random secret, hashed in DB, rotated on use.
- Token family: groups refresh tokens from the same login chain for theft response.

Response schema boundaries:
- /auth/register and /auth/login return a public user view only.
- /auth/me returns a private self view (includes own email, excludes auth internals).
- Admin endpoints return an admin view with account security metadata.

Why separate schemas:
- Authentication and authorization are separate concerns.
- Public/authenticated clients should not receive operational security metadata.
- Least-privilege response models reduce accidental data leakage during refactors.

## Login flow (high level)

1. Normalize email.
2. Query user by normalized email.
3. Always run password verification path (real hash or dummy hash).
4. Apply lockout checks and failed-attempt counters.
5. On success:
   - reset lockout state,
   - clean expired refresh tokens,
   - issue access token,
   - issue refresh token and store hash with family id.

Why this matters:
- Timing consistency reduces account enumeration signal.
- Lockout reduces brute-force practicality.
- Hashed refresh tokens reduce impact of DB read exposure.

## Refresh flow and reuse detection

1. Read refresh token from cookie.
2. Hash and lookup token record.
3. If token is revoked:
   - treat as replay/suspected theft,
   - invalidate entire family,
   - force re-login.
4. If token valid:
   - revoke current token,
   - issue new access/refresh pair in same family.

Why same-family rotation is important:
- It preserves lineage so any replay in chain can trigger family-wide invalidation.

## Lockout behavior

- Failed login counter increments on incorrect password for existing users.
- Counter threshold triggers temporary lockout timestamp.
- Successful login resets failed counter and lockout timestamp.

## Session management endpoints

- logout: revoke current refresh token and clear cookies.
- logout-all: revoke all active refresh tokens for current user.
- sessions: list active refresh-token sessions without exposing token hash/family internals.

## Security invariants

- Never store raw refresh token values in DB.
- Never expose internal token hashes/family values to clients.
- Cookie deletion must use the same path as cookie set.
- Production docs should remain disabled.
- Startup must fail fast on weak/placeholder SECRET_KEY values.
- /auth responses must never expose hashed_password.
