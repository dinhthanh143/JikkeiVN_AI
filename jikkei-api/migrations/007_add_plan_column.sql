-- Add plan column to users table for subscription tiers.

BEGIN;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free';

COMMIT;