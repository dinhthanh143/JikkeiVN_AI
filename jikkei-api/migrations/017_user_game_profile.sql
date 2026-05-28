-- Migration 017: user_game_profile
-- One row per user. Holds gamification state: currency + daily claim tracking.
-- Intentionally extensible -- future gacha/quest columns land here rather
-- than polluting `users` or the unrelated `user_credits` (AI-turn budget).
-- Numbered 017, not 016 (TAP.md's original spec number) -- 016 was already
-- taken by credit_rolling_window.sql by the time this landed.

CREATE TABLE IF NOT EXISTS user_game_profile (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Currency
  coins                 INTEGER NOT NULL DEFAULT 50,   -- soft currency, earned via quests/dailies
  gems                  INTEGER NOT NULL DEFAULT 0,    -- hard currency, bought or rare earned

  -- Daily claim
  last_daily_claimed_at TIMESTAMPTZ NULL,              -- NULL = never claimed

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_game_profile_user_id ON user_game_profile(user_id);
