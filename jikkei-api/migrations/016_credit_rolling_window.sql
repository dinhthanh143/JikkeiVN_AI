-- Migration 016: user_credits moves from a UTC-daily reset to a rolling
-- window model (TASK-011) — same mechanic as Claude's usage limits: the
-- window starts on first use and expires N hours later (see
-- app.core.config.CREDIT_WINDOW_HOURS), rather than resetting at a fixed
-- clock boundary.
--
-- `last_replenished_at` is renamed to `window_started_at` since that's what
-- it actually represents now: NULL means "no window active yet / fresh
-- account", a timestamp means "current window began at this time".
--
-- credits_remaining's DEFAULT of 20 stays as the free-tier fallback for any
-- row inserted without going through credit_service.py (defensive default
-- only — app code always sets it explicitly based on tier).

ALTER TABLE user_credits RENAME COLUMN last_replenished_at TO window_started_at;
