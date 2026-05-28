# CONTENT.md — Jikkei Index

> Single source of truth. **Read this first. Edit only the linked doc, not this file,**
> unless an index entry itself changes (new domain, renamed file, etc.).
> Last updated: 2026-07-13

---

## Project Identity

**Name:** Jikkei · **Tagline:** Stories that remember you.
**Type:** AI-powered visual novel platform — web-first, creator-driven
**Status:** Early development · V0.1-KINETIC

AI characters with persistent memory, expression/pose system driven by AI metadata,
branching relationship graph, open SillyTavern V2 character card format, creator
marketplace, adaptive audio. See [`docs/overview.md`](docs/overview.md) for full detail.

Shared story-detail modal: `src/components/panels/PlayPanel.tsx` is the canonical modal used by both Play and Profile views, including management and blue link-icon copy-link actions.

Gameplay runtime: `src/pages/StoryPage.tsx` is a thin fullscreen route. Runtime orchestration, stage rendering, controls, presentation state, and overlays live in `src/features/story/`; reusable dialogue and choice UI lives in `src/components/game/`. The backend session/turn model is authoritative; the older node-graph prototype is not part of the active runtime.

Backend AI runtime: free and premium share Gemini 2.5 Flash; premium changes only rolling usage limits. Session turns use a database claim, atomic credits, a stored stable prompt snapshot, direct Gemini streaming/non-streaming parity, and OpenRouter fallback/cache telemetry. See `docs/api.md`, `docs/security.md`, and `docs/structure.md`.

---

## Domain Map

| Domain | Source paths | Reference doc |
|---|---|---|
| Design system | `src/styles/theme.css`, `tailwind.config.ts` | [`docs/tokens.md`](docs/tokens.md) |
| File structure & status | `src/` | [`docs/structure.md`](docs/structure.md) |
| Feature roadmap | — | [`docs/features.md`](docs/features.md) |
| Packages / dependencies | `package.json` (FE) · `requirements.txt` (BE) | [`docs/packages.md`](docs/packages.md) |
| Zustand stores | `src/store/` | [`docs/stores.md`](docs/stores.md) |
| API contracts & types | `src/types/` · `src/services/backendApi.ts` | [`docs/api.md`](docs/api.md) |
| Security posture | `jikkei-api/` | [`docs/security.md`](docs/security.md) |
| Queued / deferred work | — | [`docs/queued.md`](docs/queued.md) |
| Naming conventions | global | [`docs/conventions.md`](docs/conventions.md) |
| Changelog | — | [`docs/changelog.md`](docs/changelog.md) |

---

## Quick Rules (edge cases only — full rules live in Copilot Instructions)

- **New file outside the domain table?** Document the exception here first, then create it.
- **New env var?** Add to `.env.example` and add a row to [`docs/api.md`](docs/api.md#environment-variables).
- **New npm/pip package?** Add a row to [`docs/packages.md`](docs/packages.md).
- **New Zustand store?** Document its shape in [`docs/stores.md`](docs/stores.md) before writing code.
- **New design token?** Add to [`docs/tokens.md`](docs/tokens.md) and `src/styles/theme.css`.
- **DB index added?** Note table + column in [`docs/api.md`](docs/api.md) and include the SQL.
- **Queued work decided / started?** Move the item from [`docs/queued.md`](docs/queued.md) to [`docs/features.md`](docs/features.md).

---

## Update Cheatsheet

| I changed… | Update this doc |
|---|---|
| A component, page, hook, service | `docs/structure.md` (status flag) |
| A feature (completed / added / removed) | `docs/features.md` |
| A store shape or action | `docs/stores.md` |
| An API endpoint, payload, env var | `docs/api.md` |
| A token, font, or Tailwind config | `docs/tokens.md` |
| A package (add / remove / upgrade) | `docs/packages.md` |
| A security control | `docs/security.md` |
| Anything worth noting historically | `docs/changelog.md` |
