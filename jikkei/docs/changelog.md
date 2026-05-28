# docs/changelog.md — Changelog

> Log every meaningful change here. Format: `YYYY-MM-DD · TYPE · description`
> Types: ADD · MODIFY · FIX · REMOVE · REFACTOR · SECURITY · INFRA

---

- 2026-07-13 · SECURITY · Require authentication, credits, prompt bounds, and rate limits for standalone AI chat; block private-scene session starts by non-owners.
- 2026-07-13 · FIX · Make free and premium use the same Gemini dialogue chain while premium receives only a larger rolling credit allowance.
- 2026-07-13 · FIX · Serialize turns with a crash-recoverable database claim and make credit deductions and daily rewards atomic under concurrency.
- 2026-07-13 · FIX · Snapshot cacheable scene/character/background context per session, remove duplicated player input and unsafe concurrent AsyncSession queries, and batch turn history loading.
- 2026-07-13 · MODIFY · Stream turns through direct Gemini with OpenRouter fallback, sticky cache routing, cache usage telemetry, provider timeouts, and persisted streamed token counts.
- 2026-07-13 · FIX · Make context-change replacement, deduplication, priority promotion, and session state commit atomically.
- 2026-07-13 · FIX · Keep PostgreSQL JSONB/ARRAY/vector/search production types while providing SQLite-compatible test variants and portable JSON defaults.

- 2026-07-13 · MODIFY · Shorten dialogue auto-advance timing to a 1.5-5 second range with a faster per-character delay.
- 2026-07-13 · FIX · Move the story settings exit action into the footer row beside save, remove the in-game label, and contain scrolling inside the modal body.

- 2026-07-13 · FIX · Make scene updates genuinely partial so the creator's cover-only save no longer fails validation and rolls back an otherwise completed story.
- 2026-07-13 · MODIFY · Hide the dialogue header during narration, show Redo failures as floating notifications, and match the Choice side tab to the Control tab styling.

- 2026-07-12 · REFACTOR · Split the 700-line StoryPage into the `features/story` runtime controller, stage, HUD, controls, settings, and overlay modules.
- 2026-07-12 · FIX · Add pre-turn runtime snapshots so Redo restores state and lore before regenerating the original input as a credit-consuming turn.
- 2026-07-12 · FIX · Synchronize expressions with dialogue, prefer session expression assets, refresh character attributes, persist backgrounds, preserve failed choices, and delay endings until final dialogue completes.
- 2026-07-12 · MODIFY · Standardize dialogue continuation arrows, reserve a right-side control rail, add click-to-complete and narration, and use adaptive 4-12 second auto-advance timing.
- 2026-07-12 · ADD · Add Vitest and Testing Library coverage for presentation assets, dialogue timing, choice recovery, deferred character presence, redo recovery, and backend state snapshots.

- 2026-06-06 · INFRA · Split monolithic CONTENT.md into hub-and-spoke docs structure under `jikkei/docs/`
- 2026-06-01 · FIX · Backend now falls back to local SQLite dev database when Postgres host is unreachable; auto-creates tables and seeds test login for offline local auth
- 2026-05-31 · MODIFY · Tightened dialogue box typography and padding to fit more text within fixed size; smoothed append animation fades
- 2026-05-30 · MODIFY · Dialogue box now shows loading dots before first streamed token, drains streamed text word-by-word at fixed interval, pages overflow behind top-right `>>` control
- 2026-05-26 · FIX · Confirmed browser auth flow against live 8000 backend; traced stale 8001 requests to frontend env override
- 2026-05-26 · FIX · Aligned frontend API defaults and local env to backend port 8000 so login and auth refresh requests stop targeting 8001
- 2026-07-11 · FIX · Register the static `/admin/users/inactive` route before the UUID `/admin/users/{user_id}` route so inactive-user monitoring no longer treats `inactive` as a user ID.
- 2026-07-11 · MODIFY · Record `last_seen_at` during successful login as well as refresh-token rotation.
- 2026-07-11 · REFACTOR · Reuse PlayPanel's story-detail modal for profile story previews so both surfaces render the same story information and interactions.
- 2026-07-11 · ADD · Add an icon-only story share action that copies the canonical Play link and confirms success with a brief toast.
- 2026-07-11 · FIX · Match Profile's modal management button colors to PlayPanel and use an arrow icon for copy-link.
- 2026-07-11 · MODIFY · Use the requested Font Awesome share icon and blue color for story copy links.
