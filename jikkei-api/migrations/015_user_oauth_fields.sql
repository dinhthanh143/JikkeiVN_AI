-- Migration 015: Add OAuth provider columns to users table.
-- oauth_provider: which provider ("google", "discord", etc.) — null for password accounts
-- oauth_provider_id: the provider's own stable user ID — null for password accounts
-- hashed_password: made nullable to support OAuth-only accounts with no password

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS oauth_provider    VARCHAR(50)  NULL,
  ADD COLUMN IF NOT EXISTS oauth_provider_id VARCHAR(255) NULL;

ALTER TABLE users
  ALTER COLUMN hashed_password DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth
  ON users (oauth_provider, oauth_provider_id)
  WHERE oauth_provider IS NOT NULL AND oauth_provider_id IS NOT NULL;
