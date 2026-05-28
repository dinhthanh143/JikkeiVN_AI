# docs/structure.md — File Structure & Status

> Legend: ✅ built · 🔲 not yet built · ⚠️ needs refactor
> Update the status flag here whenever a file is created, completed, or flagged.

---

## src/pages/

Route-level components — all lazy loaded via `React.lazy()` + `Suspense`.

| File | Status | Notes |
|---|---|---|
| `HomePage.tsx` | ✅ | Split layout, Persona-style menu |
| `SceneCreatorPage.tsx` | ✅ | 5-step scene creation wizard with media upload staging and partial cover save |
| `ExplorePage.tsx` | 🔲 | Placeholder |
| `StoryPage.tsx` | ✅ | Thin fullscreen route composed from `features/story` runtime modules |
| `CreatorPage.tsx` | 🔲 | Placeholder |
| `ProfilePage.tsx` | 🔲 | Placeholder |
| `AuthPage.tsx` | 🔲 | Placeholder |

---

## src/components/

### ui/ — Primitive components

| File | Status | Notes |
|---|---|---|
| `Button.tsx` | 🔲 | |
| `Badge.tsx` | 🔲 | |

### layout/

| File | Status | Notes |
|---|---|---|
| `Navbar.tsx` | 🔲 | HomePage uses inline nav — shared Navbar for other pages |
| `PageWrapper.tsx` | ✅ | Wraps children with top padding |

### panels/ — Right-side routed panel content

| File | Status | Notes |
|---|---|---|
| `HomePanel.tsx` | ✅ | |
| `PlayPanel.tsx` | ✅ | |
| `GalleryPanel.tsx` | ✅ | |
| `CreatePanel.tsx` | ✅ | |
| `CommunityPanel.tsx` | ✅ | |
| `SettingsPanel.tsx` | ✅ | Shared settings tabs with footer save action on the game tab |
| `AdminUsersPanel.tsx` | ✅ | Web-management UI placeholder |
| `AdminScenesPanel.tsx` | ✅ | Web-management UI placeholder |
| `AdminReportsPanel.tsx` | ✅ | Web-management UI placeholder |
| `AdminRolesPanel.tsx` | ✅ | Web-management UI placeholder |
| `AdminSystemPanel.tsx` | ✅ | Web-management UI placeholder |
| `PlayPanel.tsx` | ✅ | Exports the shared story-detail modal used by Play and Profile |

### home/ — Homepage-specific sections

| File | Status |
|---|---|
| `HeroScene.tsx` | 🔲 |
| `FeaturedStories.tsx` | 🔲 |
| `CharacterShowcase.tsx` | 🔲 |

### game/ — Visual novel engine UI

| File | Status |
|---|---|
| `DialogueBox.tsx` | ✅ | Paginated typewriter, click-to-complete, adaptive auto-play, headerless narration, keyboard controls |
| `ChoicePanel.tsx` | ✅ | Awaited turn submission with recoverable errors and custom prompt input |
| `ExpressionLayer.tsx` | 🔲 |
| `SceneRenderer.tsx` | 🔲 |

### features/story/ — Active visual-novel runtime

| File | Status | Notes |
|---|---|---|
| `useStoryController.ts` | ✅ | Session lifecycle, turns, true redo, cross-tab refresh, presentation cues |
| `StoryStage.tsx` | ✅ | Background and responsive multi-character sprite composition |
| `StoryHud.tsx` | ✅ | Dialogue, credits, control-styled Choice tab, retry/redo notifications, tab-lock state |
| `StoryControlPanel.tsx` | ✅ | Persistent backgrounds, expression preview, attributes, summary, restart |
| `StoryOverlays.tsx` | ✅ | Choices, completed ending, settings, restart, credit exhaustion |
| `StorySettingsModal.tsx` | ✅ | Accessible in-game settings wrapper with a footer exit/save row and internal scroll body |
| `storyPresentation.ts` | ✅ | Session/template expression resolution and character staging |

### creator/ — Story/character creation tools

| File | Status |
|---|---|
| `CharacterCardEditor.tsx` | 🔲 |
| `AssetUploader.tsx` | 🔲 |

---

## src/engine/

Rendering engines — not React UI.

| File | Status | Notes |
|---|---|---|
| `ThreeBackground.tsx` | ✅ | Floating geometry, homepage bg |
| `SceneManager.ts` | 🔲 | PixiJS scene orchestration |
| `SpriteLayer.ts` | 🔲 | Character sprite + expression system |
| `AudioManager.ts` | 🔲 | Howler.js adaptive audio wrapper |

---

## src/store/

Zustand stores — see [`docs/stores.md`](stores.md) for shapes.

| File | Status |
|---|---|
| `useGameStore.ts` | ✅ |
| `usePlayerStore.ts` | ✅ |
| `useAudioStore.ts` | ✅ |

---

## src/hooks/

| File | Status | Notes |
|---|---|---|
| `useCharacter.ts` | 🔲 | |
| `useCloudinary.ts` | 🔲 | Always use for image assets — never raw `<img>` |
| `useAuth.ts` | 🔲 | |

---

## src/services/

| File | Status | Notes |
|---|---|---|
| `api.ts` | ✅ | Axios instance, auth interceptors |
| `cloudinary.ts` | 🔲 | |
| `characterService.ts` | 🔲 | |
| `storyService.ts` | 🔲 | |

---

## src/types/

| File | Status | Notes |
|---|---|---|
| `character.ts` | ✅ | `CharacterCard`, `CharacterExpression`, `LoreEntry` |
| `story.ts` | ✅ | `StoryNode`, `Choice`, `SceneEffect`, `Story` |
| `scene.ts` | 🔲 | |
| `user.ts` | 🔲 | |
| `api.ts` | 🔲 | |

---

## src/lib/

| File | Status | Notes |
|---|---|---|
| `cn.ts` | ✅ | clsx + tailwind-merge — always use `cn()` for classNames |
| `constants.ts` | 🔲 | |
| `formatters.ts` | 🔲 | |

---

## src/styles/

| File | Status | Notes |
|---|---|---|
| `globals.css` | ✅ | Base reset |
| `theme.css` | 🔲 | CSS variables (see `docs/tokens.md`) |
| `fonts.css` | 🔲 | @font-face / Google Fonts import |
| `animations.css` | 🔲 | Shared keyframes |

---

## Files Outside the Domain Table

> Any file created outside the domains above must be documented here with justification.

| File | Reason |
|---|---|
| *(none yet)* | |

---

## jikkei-api/app/services/

| File | Status | Notes |
|---|---|---|
| `ai_service.py` | ✅ | Direct Gemini JSON + streaming primary, OpenRouter fallback, cache telemetry, atomic turn application |
| `context_builder.py` | ✅ | Stored stable-prefix snapshot, session-owned expressions/backgrounds, batched history and sequential RAG queries |
| `credit_service.py` | ✅ | Rolling-window provisioning and atomic one-credit deduction |
| `game_service.py` | ✅ | Atomic 24-hour daily coin claim |
| `lore_service.py` | ✅ | Hybrid retrieval, deduplication, and single boosted context-change lifecycle |
| `turn_claim.py` | ✅ | Short-lived database lease that serializes turns across workers without an open provider-call transaction |
