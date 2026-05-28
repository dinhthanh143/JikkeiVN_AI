-- Remove account lockout columns from users table
-- Run this in Supabase SQL Editor to remove obsolete lockout fields

ALTER TABLE users
  DROP COLUMN IF EXISTS failed_login_attempts,
  DROP COLUMN IF EXISTS locked_until;
