-- Fix user_subscriptions.plan check constraint: was 'free'|'pro', code uses 'free'|'premium'.

BEGIN;

ALTER TABLE public.user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_plan_check;

UPDATE public.user_subscriptions
    SET plan = 'premium'
    WHERE plan = 'pro';

ALTER TABLE public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_plan_check
    CHECK (plan = ANY (ARRAY['free'::text, 'premium'::text]));

COMMIT;
