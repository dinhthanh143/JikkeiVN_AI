# docs/queued.md — Queued & Deferred Work

> Nothing here is forgotten. Each item has a trigger condition.
> When work starts, move the item to `docs/features.md` and update `docs/security.md` if relevant.

---

## Q-01 · Cloudflare — DDoS + WAF Protection

**Protects against:** Volumetric DDoS, password spray across many IPs, known malicious bots, Layer 7 HTTP flood.

**Why deferred:** Requires a real domain pointed at a deployed server. Cannot test on localhost.

**Setup (when ready):**
1. Buy a domain → create Cloudflare account → Add site → point nameservers
2. DNS: A record → your server IP
3. Enable "Under Attack Mode" initially for testing
4. WAF → Managed Rules → OWASP ruleset
5. Rate limit rule: > 100 req/min per IP → block 1 hour

**Trigger:** Day you deploy to a real server with a domain.

---

## Q-02 · Nginx — Reverse Proxy + SSL Termination

**What it does:** HTTPS/SSL via Let's Encrypt, gzip compression, static file serving, additional rate limiting, HTTP → HTTPS redirect.

**Why deferred:** Not useful without a deployed server. Railway and Render handle SSL automatically — Nginx only needed for self-hosted VPS (DigitalOcean, Hetzner).

**Trigger:** If you move from Railway/Render to a self-managed VPS. If you stay on Railway/Render, skip this entirely.

---

## Q-03 · Prometheus + Grafana — Monitoring Dashboard

**What it shows:** Slow endpoints, DB connection pool saturation, spike in 401s (possible attack), memory usage per worker.

**Why deferred:** Meaningless without real traffic.

**Trigger:** First 10 real users, or when you notice performance issues you can't diagnose from logs.

---

## Q-04 · Email Verification + Password Reset

**What's needed:**
- Email provider (Resend, SendGrid, Postmark) + API key
- `resend` or `sendgrid` Python package → add to `docs/packages.md`
- Two new DB tables: `email_verifications`, `password_resets`
- Two new routes: `POST /auth/verify-email`, `POST /auth/reset-password`
- HTML email templates

**Why deferred:** Auth itself needs to be solid first. Email is a layer on top.

**Trigger:** Before any public launch. Build after the frontend auth flow (login/register UI) is working.

---

## Q-05 · Global Login Rate Limiting (Password Spray Defense)

**What it does:** Tracks total login attempts across ALL IPs globally. If > 500 logins/min site-wide, adds 1-second artificial delay to all login responses.

**Why deferred:** Requires Redis atomic counter. Low priority until user base exists.

**Trigger:** Distributed login attack patterns in logs, or 1,000+ users.

---

## Q-06 · Sentry — Production Error Tracking

**Status:** Code already installed and integrated. Disabled because `SENTRY_DSN` is empty.

**Setup:**
1. sentry.io → New Project → Python → FastAPI
2. Copy DSN → add to Railway/Render env vars as `SENTRY_DSN`
3. Deploy → trigger a test error → verify in dashboard

**Trigger:** Day of first production deployment.
