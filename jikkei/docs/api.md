# docs/api.md — API Contracts, Types & Environment

> Keep FE/BE payload and response fields identical in name, type, and nullability.
> Document every discrepancy here. Add env vars to `.env.example` first.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_API_SERVER_URL` | Backend API origin for cookie-auth requests (e.g. `http://localhost:8000`) |
| `VITE_API_BASE_URL` | Backend API base URL |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |
| `SENTRY_DSN` | Sentry DSN — leave empty in dev; set in production environment only |
| `CREDIT_WINDOW_HOURS` | Rolling credit-window duration shared by free and premium accounts |
| `SESSION_CREDITS_FREE` | Free-account AI calls per rolling window |
| `SESSION_CREDITS_PREMIUM` | Premium-account AI calls per rolling window; model quality is unchanged |
| `GEMINI_DIRECT_TIMEOUT_SECONDS` | Timeout before direct Gemini falls back to OpenRouter |
| `OPENROUTER_TIMEOUT_SECONDS` | Per-request OpenRouter timeout |
| `OPENROUTER_MAX_RETRIES` | OpenRouter SDK retry cap before model fallback proceeds |
| `TURN_CLAIM_TTL_SECONDS` | Crash-recovery TTL for a session's in-flight turn claim |
| `RATE_LIMIT_AI_CHAT` | Per-IP limit for authenticated standalone AI chat routes |

> All vars must exist in `.env.example` with placeholder values. Never commit real values.

---

## Backend URL Convention

- Production: `postgresql+psycopg://...`
- Dev fallback: local SQLite — auto-created with tables seeded when Postgres host is unreachable, so local auth works offline.

---

## HTTP Client

`src/services/api.ts` — Axios configured instance with:
- Base URL from `import.meta.env.VITE_API_BASE_URL`
- Cookie credentials included on every request
- Auth interceptor — concurrent refresh attempts are deduplicated to prevent rate-limit cascade

All backend calls go through this instance. No hardcoded `fetch()` in components.

---

## Endpoint Contracts

| Endpoint | Backend Schema | Frontend Type | Notes |
|---|---|---|---|
| `POST /auth/login` | `LoginRequest(email?: EmailStr, username?: str, password: str)` | `LoginPayload` in `backendApi.ts` | FE detects email vs username via `@` check |
| `POST /auth/register` | `RegisterRequest(email: EmailStr, username: str, password: str)` | `RegisterPayload` in `authService.ts` | Must match exactly |
| `POST /auth/refresh` | Returns new access/refresh token pair | (cookies only) | Concurrent attempts deduplicated by interceptor |
| `PUT /api/scenes/{scene_id}` | `SceneUpdateRequest` (all fields optional) | `SceneUpdatePayload` | Partial update; omitted fields are preserved. Cover-only saves do not rerun lore embedding. |
| `GET /api/sessions/latest/by-scene/{scene_id}` | `SessionResponse` | `SessionRecord` | Returns the latest active or completed run so endings survive reload |
| `POST /api/sessions/turn` | `TurnResponse` | `TurnResponseRecord` | Returns messages, session snapshot, and authoritative session characters |
| `POST /api/sessions/turn/stream` | SSE ending in `{done: true, turn: TurnResponse}` | `TurnResponseRecord` | Direct Gemini stream with OpenRouter fallback; server persists usage and owns the turn claim |
| `POST /api/sessions/{id}/redo` | `TurnResponse` | `TurnResponseRecord` | Restores `DialogueTurn.state_before`, removes discarded turn lore, regenerates the original input, and consumes one credit |
| `PUT /api/sessions/{id}/starting-background` | `{ok: boolean}` | `void` service result | Persists the current session background used by gameplay and AI context |
| `POST /api/ai/chat` | `ChatRequest(prompt, tier? deprecated)` | `ChatResponse` | Cookie auth, one credit, and `RATE_LIMIT_AI_CHAT`; client tier is ignored because all accounts share one model chain |
| `POST /api/ai/chat/stream` | SSE token/done/error events | `StreamChatCallbacks` | Same auth/credit/rate-limit rules as non-streaming chat |

### Scene-session persistence additions

Migration `021_turn_claim_and_prompt_snapshot.sql` adds:

- `scene_description_snapshot` and `scene_is_nsfw_snapshot` — immutable scene inputs captured at start.
- `stable_prompt` — byte-stable system prompt reused until a session-owned static edit invalidates it.
- `turn_claim_id` and `turn_claimed_at` — short-lived cross-worker lease; parallel turns return `409 TURN_IN_PROGRESS`.
- `backgrounds.session_id` plus per-session background backfill freezes the background set for active playthroughs.
- Session character expressions are snapshotted so later template edits do not change active playthroughs.

---

## DB Indexes

> Add a row here whenever a new index is added. Include the SQL.

| Table | Column(s) | Reason | SQL |
|---|---|---|---|
| `backgrounds` | `session_id` | Load and cascade-delete session-owned background snapshots | `CREATE INDEX IF NOT EXISTS idx_backgrounds_session_id ON public.backgrounds(session_id);` |
| `session_character_expressions` | `session_character_id, slot_key` | Enforce one expression slot per session character | `CREATE UNIQUE INDEX IF NOT EXISTS uq_session_character_expressions_char_slot ON public.session_character_expressions(session_character_id, slot_key);` |

---

## Test Commands

```bash
# Run backend tests
cd jikkei-api
pytest tests/ -v

# Run frontend gameplay tests
cd jikkei
npm run test

# Run with coverage
pip install pytest-cov
pytest tests/ -v --cov=app --cov-report=term-missing

# Start dev server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
