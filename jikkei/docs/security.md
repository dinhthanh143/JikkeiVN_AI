# docs/security.md — Security Posture

> Update this file when a control is added, changed, or promoted from queued to active.
> For deferred security work, see [`docs/queued.md`](queued.md).

---

## Covered

| Threat | Control |
|---|---|
| SQL injection | SQLAlchemy parameterized queries |
| XSS token theft | `httpOnly` cookies — JS cannot read tokens |
| CSRF | `SameSite=lax` cookie attribute |
| Brute force | slowapi rate limiting per IP |
| Token replay | Refresh token rotation with family invalidation |
| Timing attack | Dummy bcrypt hash runs even for missing users |
| Mass assignment | Pydantic schema blocks unknown fields |
| Clickjacking | `X-Frame-Options: DENY` + CSP `frame-ancestors` |
| App-layer DoS | 1 MB request body size limit |
| Stack trace leakage | Global exception handler returns safe messages |
| Memory leaks | Gunicorn `max_requests` worker recycling |
| Stale DB connections | `pool_pre_ping` + `pool_recycle` |
| AI endpoint cost abuse | Cookie authentication, credit deduction, bounded prompt length, and per-IP limits |
| Private scene access | Session start requires a public scene or matching scene owner |
| Parallel turn double-spend | Atomic database turn claim plus atomic credit decrement |
| Duplicate daily reward | Conditional atomic update on the 24-hour claim boundary |

---

## Partially Covered

| Threat | Current state | Gap |
|---|---|---|
| Password spray | Per-IP rate limit only | No global counter across IPs yet |
| Dependency vulnerabilities | pip-audit in CI | Manual review still needed |

---

## Queued / Not Started

See [`docs/queued.md`](queued.md) for full detail on each item.

- Q-01 · Cloudflare — DDoS + WAF (needs live domain)
- Q-02 · Nginx reverse proxy + SSL (needs deployed server)
- Q-03 · Prometheus + Grafana monitoring (needs real traffic)
- Q-04 · Email verification + password reset (needs email provider)
- Q-05 · Global login rate limiting / password spray defense (needs Redis)
- Q-06 · Sentry production error tracking (enable DSN on first deploy)
