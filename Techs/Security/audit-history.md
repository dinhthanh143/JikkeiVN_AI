# Audit History

Reference log of key security audit outcomes and fixes.

## 2026-04 hardening cycle

### What was run
- Bandit static scan against backend source.
- pip-audit dependency vulnerability scan against requirements lock.

### Results summary
- Bandit: no medium/high issues reported in scanned backend source during the hardening pass.
- pip-audit: vulnerabilities were detected in a subset of pinned dependencies.

Identified dependency risk highlights:
- python-jose 3.3.0: advisories with fix available in 3.4.0.
- python-multipart 0.0.12: CVEs with fixes available in newer releases.
- starlette 0.38.6: CVEs requiring framework-compatible upgrade path.

### Controls added during this cycle
- Centralized exception handling for safe error envelopes.
- Structured logging setup for unified operational visibility.
- Security headers middleware.
- Request body size limit middleware.
- Request ID correlation header.
- Production process model via Gunicorn worker manager.
- CI security workflow for recurring scans.

## 2026-04-14 security regression hardening

### What changed
- Startup config validation now fails fast on weak SECRET_KEY values.
- Auth response schemas were split into public/private/admin views.
- BOLA ownership-check foundation was added as a shared dependency utility.
- Pytest security integration suite was added for auth and admin access boundaries.
- CI workflow now executes pytest security tests after static scans.

### Why this matters
- Prevents insecure deployments from booting silently.
- Reduces accidental response data leakage by endpoint context.
- Establishes explicit authorization pattern for future user-owned resources.
- Catches runtime auth/access regressions that static scanners cannot detect.

## Recommended follow-up sequence

1. Dependency remediation batch A (low coupling)
- Upgrade python-jose.
- Upgrade python-multipart.

2. Dependency remediation batch B (framework coupling)
- Plan and test coordinated FastAPI + Starlette update.

3. Verification
- Re-run pip-audit.
- Re-run bandit.
- Run auth regression tests (login, refresh, lockout, sessions, logout-all).

4. Deployment guardrails
- Add policy gates: fail release on high severity vulnerabilities unless documented exception exists.
