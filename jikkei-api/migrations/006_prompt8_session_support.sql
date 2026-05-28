-- Prompt 8 compatibility migration.
-- Ensures user_credits exists and scenes support soft delete.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    credits_remaining INTEGER NOT NULL DEFAULT 20,
    credits_lifetime_used INTEGER NOT NULL DEFAULT 0,
    last_replenished_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.scenes
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMIT;
