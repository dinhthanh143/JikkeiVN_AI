-- TASK-014: Stripe billing foundation. Applied directly to Supabase via MCP
-- on 2026-07-13; this file mirrors that for the repo's own migration history.
-- See database-schema.md for full column docs and the reasoning (e.g. why
-- there's no `products` table — price->grant mapping lives in code, see
-- app/core/billing.py).

CREATE TABLE IF NOT EXISTS public.stripe_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id),
  stripe_customer_id text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  stripe_customer_id text NOT NULL,
  stripe_price_id text,
  type text NOT NULL CHECK (type = ANY (ARRAY['subscription_purchase'::text, 'subscription_renewal'::text, 'coin_pack'::text, 'gem_pack'::text, 'refund'::text])),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text, 'refunded'::text])),
  granted_coins integer DEFAULT 0,
  granted_gems integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  payload jsonb
);

ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own stripe_customers" ON public.stripe_customers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users read own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);
-- stripe_webhook_events: no policies -- backend uses service role only, no client access needed
