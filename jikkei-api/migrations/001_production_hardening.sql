-- Production hardening migration for Jikkei API
-- Run this in Supabase SQL Editor to apply all schema changes

-- Add token_family column to refresh_tokens table for theft detection
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS token_family TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- Index for fast family lookups during reuse detection
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family 
  ON refresh_tokens(token_family);

-- Index for fast per-user token queries (list_sessions endpoint)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id 
  ON refresh_tokens(user_id);
