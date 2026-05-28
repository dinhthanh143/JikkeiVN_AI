<!-- AGENT COORDINATION FILE — READ ONLY HEADER, THIS FILE IS SHARED ACROSS DIFFERENT CHAT WINDOWS/AIs -->
<!--
- List all tasks/batches with IDs(If newly assigned), current status 
- Per task: describe what, which file(s), which part (paths relative to project root), the detailed flow
- ONLY focus on the assinged tasks/batches by the user
- Status: [ ] todo | [~] in progress | [x] done | [!] blocked
- Delete completed tasks (keep file lean)
- On pickup: claim a task by adding your session/agent ID next to [~]
- Note blockers or decisions needed under [!] tasks
- Before executing any task, use the cbm_search_graph / cbm_trace_call_path / cbm_get_architecture tools (codebase-memory-mcp) to check relevant code structure first
- Do NOT modify this header

- RISK TIERS: every task gets a [LOW] or [HIGH] tag. HIGH = touches payment amounts, secrets/API keys,
  webhook signature verification, idempotency keys, auth, or a DB schema migration. See CLAUDE.md
  "Risk Tiers & Escalation" for the full criteria and reasoning.
- QUEUE RULE (hard boundary, do not soften this): an autoloop session may ONLY pull tasks from the
  🟢 AUTOLOOP QUEUE section below. It must NEVER read into or execute anything under 🔴 GATED QUEUE
  unless the user's prompt explicitly names that task (e.g. "work on TASK-016"). If the AUTOLOOP QUEUE
  is empty, stop and report — do not fall through to GATED QUEUE on your own.
- MID-TASK ESCALATION: if a task that started as [LOW] turns out to touch anything in the HIGH criteria
  above, STOP immediately, do not complete it, move it to 🔴 GATED QUEUE with a one-line note on why it
  escalated, and end the session. Do not finish it "since you're already in there."
-->

# Tasks

## 🟢 AUTOLOOP QUEUE
<!-- Loop-safe tasks only. Agent may self-continue through these without stopping for review. -->

- [ ] TASK-017 [LOW] Frontend billing service layer
  - File: `jikkei/src/services/billingApi.ts` (new)
  - Thin wrappers over TASK-015 endpoints: `createCheckoutSession(priceId)`, `createPortalSession()`, `fetchTransactions(page, pageSize)`. Follows existing `backendApi.ts` service pattern — no direct `fetch()` calls from components. No secrets touched, just HTTP calls to our own backend.
  - Depends on: TASK-015 (endpoints must exist first)

- [ ] TASK-018 [LOW] Frontend billing UI wiring
  - Files: existing pricing/shop component(s), new `jikkei/src/pages/BillingSuccessPage.tsx`, `BillingCancelPage.tsx`, new billing history section (TanStack Query + `fetchTransactions`)
  - Wire "Upgrade to Premium" button → `createCheckoutSession()` → `window.location = session.url`. Add `/billing/success` and `/billing/cancel` routes. Loading/error states per CLAUDE.md conventions.
  - Depends on: TASK-017

- [ ] TASK-019 [LOW] Docs update
  - File: `jikkei/CONTENT.md`
  - Add new services (`billingApi.ts`) and note `stripe` package added to backend `requirements.txt`. Standard post-change doc sync per CLAUDE.md.
  - Depends on: TASK-014 through TASK-018 substantially done (so the doc reflects final shape)

---

## 🔴 GATED QUEUE
<!-- Requires explicit "work on TASK-XXX" pickup from the user. Do NOT self-continue into this section. -->

- [ ] TASK-014 [HIGH] Stripe service layer
  - File: `jikkei-api/app/services/stripe_service.py` (new)
  - `get_or_create_customer(user)` — check `stripe_customers` table first, else create via Stripe API + insert row. `create_checkout_session(user, price_id, mode)` — resolves grant via `app/core/billing.py::get_price_grant()`, rejects unknown price_id. `create_portal_session(user)` for subscription self-management.
  - Reason for HIGH: touches `STRIPE_SECRET_KEY`, initiates real payment amounts.
  - Depends on: none (billing.py + config already done)

- [ ] TASK-015 [HIGH] Checkout + portal endpoints
  - Files: `jikkei-api/app/routers/billing.py` (new), Pydantic schemas in `app/schemas/`
  - `POST /billing/checkout-session`, `POST /billing/portal-session`, `GET /billing/transactions` (paginated, scoped to `current_user`, read-only so lower risk but grouped here since file is shared with the above two).
  - Reason for HIGH: payment amounts, auth-scoped endpoints.
  - Depends on: TASK-014

- [ ] TASK-016 [HIGH] Webhook handler
  - File: `jikkei-api/app/routers/billing.py` (webhook route), possibly `app/services/webhook_service.py`
  - `POST /billing/webhook` — verify Stripe signature FIRST (reject on failure), then idempotency check against `stripe_webhook_events.stripe_event_id` BEFORE any side effect, insert event row only after successful processing. Handle: `checkout.session.completed` (insert `transactions` succeeded, grant plan/coins/gems), `invoice.paid` (renewal, extend `current_period_end`), `invoice.payment_failed` (mark failed), `customer.subscription.deleted` (mark cancelled).
  - Reason for HIGH: webhook signature verification + idempotency keys — the single highest-risk piece in this feature. Do not simplify signature or idempotency checks even under time pressure.
  - Depends on: TASK-014

---

## ⏸ PENDING VERIFICATION
<!-- Code complete, awaiting manual/browser confirmation. Not agent-executable — needs a live session. -->

- [ ] TASK-020 Manual Stripe test-mode verification (after TASK-014–016 complete)
  - Real checkout in Stripe test mode → confirm `transactions` row inserted + correct grant applied to `user_subscriptions`
  - `stripe trigger checkout.session.completed` twice (simulate redelivery) → confirm NO double-grant, second delivery short-circuits on `stripe_webhook_events`
  - `stripe listen --forward-to localhost:8000/billing/webhook` running locally for the above

