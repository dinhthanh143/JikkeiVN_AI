# CLAUDE.md — Jikkei Quick Context
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 0. LookUp/Search file (Skip if not available)
- Before reading files or editing, use the available codebase-memory MCP tools first: `search_graph` to locate the exact symbol, `trace_path` to inspect callers/callees or data flow, and `get_architecture` for broader structure when relevant.
- Start with `search_graph`; do not guess a symbol name. Reuse its exact `qualified_name` when calling `trace_path` or `get_code_snippet`.
- Form one local hypothesis from the graph and perform one cheap check before editing only that slice.
- If the codebase-memory MCP server or its tools are unavailable, continue with normal repository tools such as `rg`, file inspection, and tests; do not block the task solely because CBM is unavailable.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Mission
- AI visual novel platform with persistent memory, branching outcomes, and creator-first workflows.
- Visual direction: Persona-like, asymmetric, high-contrast pink/black/white.

## Non-Negotiable Workflow
- Read jikkei/CONTENT.md before coding; treat it as source of truth.
- After any feature/component/hook/service/store/library change, update jikkei/CONTENT.md.
- Add changelog line: YYYY-MM-DD · TYPE · description (ADD/REMOVE/MODIFY/FIX/REFACTOR).
- If CONTENT.md is not updated, state: "CONTENT.md not updated — reason: ...".

## Architecture Rules
- Frontend-backend payload/response schemas must match exactly (fields, types, nullability).
- No direct fetch calls inside components; use service layer, including src/services/backendApi.ts.
- Document FE/BE type aliases in CONTENT.md when names differ.

## Frontend Rules
- TypeScript strict, no any, no ts-ignore without explicit reason.
- Components use explicit Props interfaces and const arrow syntax.
- Import order: React → third-party → @/ → relative.
- Use cn() for className merging.
- Tailwind first; use tokens from src/styles/theme.css, avoid hardcoded design colors.
- Keep business logic in hooks/services, not in page components.
- Forms: React Hook Form + Zod.
- Server state: TanStack Query; avoid useEffect-based fetching.
- Zustand only for defined client state domains (UI/game/audio/player).

## UX and Performance
- Lazy-load pages with React.lazy + Suspense.
- Use Three.js/PixiJS for frame-by-frame visuals, not heavy plain TS/CSS loops.
- All async flows must show loading and error states.
- All interactive controls must be keyboard-accessible with hover/focus/active states.

## Hard Don’ts
- No direct localStorage auth/token handling.
- No hardcoded API URLs; use VITE_* env vars.
- No console.log in production code.
- No new package without adding it to CONTENT.md Libraries.
- No raw image tags for character/story assets; use useCloudinary.

## Done Criteria
- tsc --noEmit passes.
- ESLint passes.
- CONTENT.md updated.
- Accessibility + async state handling verified.

## Risk Tiers & Escalation
Every task in TasksAndProgress_TAP.md is tagged [LOW] or [HIGH]. This determines whether it can run
in an unattended autoloop ("Continue" session) or requires the user to be present turn-by-turn.

**[HIGH] — any of these, no exceptions:**
- Payment amounts, pricing, or billing calculations (Stripe or otherwise)
- Secrets / API keys / anything touching env credentials
- Webhook signature verification
- Idempotency key handling
- Auth (login, session, token, permission checks)
- Database schema migrations

**[LOW]** — everything else: repetitive UI/CRUD following an already-established pattern, styling,
copy changes, non-schema-changing refactors, test-writing for existing low-risk code.

**Hard stop rule:** if you are mid-task on something tagged [LOW] and it turns out to touch any of the
HIGH criteria above, stop immediately. Do not finish the task. Move it to the 🔴 GATED QUEUE in TAP.md
with a one-line note explaining why it escalated, and end the session. This rule exists because HIGH-tier
bugs (a bad webhook check, a race condition in credit deduction) are real-money/security bugs, not just
quality issues — they don't get a second chance to be caught before they ship.

## Decisions Log
Append-only. One or two lines per entry. Record *why* a non-obvious call was made, not what changed
(CONTENT.md's changelog already covers what). This exists so future sessions don't silently re-litigate
or contradict a decision they don't have context for.

- rolling 5-hour credit window (replacing UTC-daily reset) — reason: UTC-daily reset let users game
  the boundary (burn credits right before midnight UTC, get a fresh batch minutes later); rolling window
  removes that exploit.
- credits moved into usePlayerStore — reason: was being fetched per-mount per-component, causing visible
  flashes of stale/zero credits on navigation; centralizing in the store fixed it.
