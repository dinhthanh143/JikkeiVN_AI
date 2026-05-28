# docs/features.md — Feature Roadmap

> Track feature status here. Move items from `docs/queued.md` to this file when work starts.
> Keep phases in order; mark items as done inline.

---

## Phase 1 — Engine (current)

- [x] Homepage — split layout, Persona-style asymmetric menu
- [x] Three.js floating geometry background
- [x] Panel system — Play, Gallery, Community, Settings
- [x] Admin taskbar mode — role=admin switches sidebar to web-management tabs (Users, Scenes, Reports, Roles, System)
- [ ] `theme.css` — extract all CSS variables into one file
- [ ] Shared `<Navbar>` for non-homepage pages
- [ ] `<Button>` and `<Badge>` UI primitives

---

## Phase 2 — AI Brain

- [ ] PixiJS scene renderer (`SceneRenderer.tsx`)
- [x] Character sprite + expression layer system — session/template assets with dialogue-synced expression cues
- [x] Dialogue box with paginated typewriter, click-to-complete, headerless narration, keyboard controls, adaptive auto-play
- [x] Choice panel with generated options and custom player prompts
- [x] Zustand game state connected to backend session/turn transitions
- [x] Shared Gemini dialogue model for free and premium; premium increases credits/usage only
- [x] Prompt-cache-ready dialogue pipeline — session-stable prefix snapshot, Gemini/OpenRouter cache telemetry, sticky fallback routing
- [x] Cross-worker turn serialization with atomic credit/daily-reward updates and streamed token accounting
- [ ] AI presentation metadata — expressions/background/presence built; music and effects remain
- [x] RAG lore system — pgvector-backed session and character memory
- [x] Lossless latest-turn Redo via pre-turn runtime snapshots, regeneration, and non-blocking failure notifications
- [x] Completed-story resume with explicit Play Again
- [ ] Adaptive audio — Howler.js stems, music state machine

---

## Phase 3 — Creator Platform

- [ ] Character Card editor (visual)
- [ ] Expression sheet uploader (Cloudinary)
- [ ] Story branching editor (node graph)
- [ ] SillyTavern V2 card import/export
- [ ] Creator profile page

---

## Phase 4 — Community & Economy

- [ ] Story marketplace
- [ ] Character sharing / rating
- [ ] Creator subscriptions
- [ ] Story rooms (async multiplayer)
