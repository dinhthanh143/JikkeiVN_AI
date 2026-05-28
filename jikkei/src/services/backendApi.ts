import { LEGAL_BUNDLE_VERSION } from '@/content/legal/legalDocuments'

const API_ORIGIN = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:8000'

export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login', register: '/auth/register', logout: '/auth/logout',
    refresh: '/auth/refresh', me: '/auth/me',
    legalStatus: '/auth/legal/status', legalAccept: '/auth/legal/accept',
  },
  admin: { users: '/admin/users' },
  upload: { image: '/api/upload', signature: '/api/upload/signature' },
  scenes: { root: '/api/scenes', sessions: '/api/sessions' },
  users: { root: '/api/users' },
} as const

// ── Auth / User ───────────────────────────────────────────────────────────────

export interface BackendUser {
  id: string; username: string; role: string; avatar_url: string | null; created_at: string; is_active: boolean; tier: 'free' | 'premium'
}
export interface LoginPayload { email?: string; username?: string; password: string }
export interface RegisterPayload { email: string; username: string; password: string }
export interface LegalStatusResponse {
  required_legal_version: string; legal_version_accepted: string | null
  agreed_to_latest_legal: boolean; requires_reaccept: boolean
}
export interface AdminUserRecord {
  id: string; email: string; username: string; display_name: string | null; role: string
  avatar_url: string | null; is_active: boolean; created_at: string; updated_at: string
  last_login_at: string | null; last_seen_at: string | null
}
export interface AdminUsersPageResponse {
  items: AdminUserRecord[]; total: number; limit: number; offset: number; has_next: boolean
}
export interface AdminUsersQuery {
  q?: string; role?: 'user' | 'admin'; is_active?: boolean; limit?: number; offset?: number
}

// ── Scene (template) ──────────────────────────────────────────────────────────

export interface SceneCreatePayload { title: string; description?: string | null; game_mode: 'normal' | 'survival'; is_nsfw?: boolean; tier?: 'free' | 'premium'; is_public?: boolean; scene_cover?: string | null }
export interface SceneRecord {
  id: string; title: string; description: string | null; game_mode: 'normal' | 'survival'
  tier: 'free' | 'premium'; is_public: boolean; is_nsfw: boolean; scene_cover: string | null; created_at: string; updated_at: string
}
export interface ExpressionRecord {
  id: string; character_id: string; slot_key: string; display_name: string
  image_url: string | null; display_order: number
}
export interface AttributeDefinitionRecord {
  id: string; character_id: string; attr_key: string; display_name: string
  initial_value: number; min_value: number; max_value: number; is_visible_to_player: boolean; display_order: number
}
export interface CharacterRecord {
  id: string; scene_id: string; user_id: string; name: string; description: string
  avatar_url: string | null; voice_id: string | null; position: number; initial_dialogue: string | null
  created_at: string; expressions: ExpressionRecord[]; attributes: AttributeDefinitionRecord[]
}
export interface BackgroundRecord { id: string; scene_id: string; session_id: string | null; name: string; image_url: string; created_at: string }
export interface SceneDetailRecord extends SceneRecord {
  user_id: string; starting_background_id: string | null; play_count: number
  characters: CharacterRecord[]; backgrounds: BackgroundRecord[]; author: string | null
}

// ── Session (runtime) ─────────────────────────────────────────────────────────

export interface SessionCharacterExpressionRecord {
  id: string; session_character_id: string; slot_key: string; display_name: string
  image_url: string | null; display_order: number
}

export interface SessionCharacterRecord {
  id: string; session_id: string; source_character_id: string | null
  name: string; description: string | null; avatar_url: string | null
  voice_id: string | null; position: number | null; initial_dialogue: string | null
  is_active: boolean; is_session_only: boolean
  status: 'active' | 'inactive'
  current_expression_key: string | null
  attribute_values: Record<string, number>
  created_at: string; updated_at: string
  expressions: SessionCharacterExpressionRecord[]
}

export interface TurnMessageRecord {
  id: string; turn_id: string; session_character_id: string | null
  speaker_type: 'character' | 'narrator'
  messages: string[]; expression_key: string | null; speaker_order: number; created_at: string
  // TASK-009 — only set (non-null) when the AI's response actually changed
  // this character's presence THIS turn; null means "unchanged". Drives
  // dialogue-synced disappearance via useGameStore.pendingCharChanges.
  resulting_status?: 'active' | 'inactive' | null
  resulting_is_active?: boolean | null
}

export interface SessionRecord {
  id: string; scene_id: string; user_id: string; game_mode: 'normal' | 'survival'; turn_count: number
  is_active: boolean; is_resumable: boolean
  current_background_id: string | null; current_background: BackgroundRecord | null
  world_events: string[]; history_summary: string | null
  active_context_change: string | null; context_change_turns_remaining: number
  outcome: string | null; outcome_message: string | null
  started_at: string; ended_at: string | null; created_at: string; updated_at: string
  session_characters: SessionCharacterRecord[]
  current_choices: string[]
  turn_zero_messages: TurnMessageRecord[]
  latest_turn_messages: TurnMessageRecord[]
}

// ── Turn / Dialogue ───────────────────────────────────────────────────────────

export interface TurnRequest {
  session_id: string
  input_type: 'prompt' | 'option' | 'context_change' | 'redo' | 'system'
  player_input?: string; context_change_text?: string
}

export interface TurnResponseRecord {
  id: string; session_id: string; turn_number: number; input_type: string
  player_input: string | null; attribute_delta: Record<string, number>
  background_changed_to: string | null; scene_event: string | null
  options_presented: string[]; tokens_used: number | null; created_at: string
  turn_messages: TurnMessageRecord[]
  session_characters: SessionCharacterRecord[]
  session_state: Pick<
    SessionRecord,
    | 'turn_count' | 'is_active' | 'world_events' | 'history_summary'
    | 'active_context_change' | 'context_change_turns_remaining'
    | 'outcome' | 'outcome_message' | 'current_background_id' | 'current_background'
  >
}

// ── Creator / Upload payloads ─────────────────────────────────────────────────

export interface CharacterCreatePayload { name: string; description: string; avatar_url?: string | null; position: number; initial_dialogue?: string | null }
export interface ExpressionUpdateItem { slot_key: string; display_name: string; image_url: string | null }
export interface AttributeUpdateItem { attr_key: string; initial_value: number; is_visible_to_player: boolean }
// TriggerCreatePayload removed alongside createCharacterTrigger() below —
// see that removal note for why.
export interface BackgroundCreatePayload { name: string; image_url: string; session_id?: string | null }
export interface UploadMediaPayload { file: File; folder: 'avatar' | 'expression' | 'background'; sceneId?: string }
export interface UploadMediaResponse {
  url: string; public_id: string; folder: string; bytes: number
  format: string | null; width: number | null; height: number | null
}
export interface ChatResponse { text: string }

// ── Error handling ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.name = 'ApiError'; this.status = status }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string') return payload
  if (Array.isArray(payload)) {
    const messages = payload.map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') { const m = Reflect.get(item, 'msg'); if (typeof m === 'string') return m }
      return ''
    }).filter(Boolean)
    return messages.length > 0 ? messages.join(' ') : fallback
  }
  if (payload && typeof payload === 'object') {
    const detail = Reflect.get(payload, 'detail')
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return getErrorMessage(detail, fallback)
    if (detail && typeof detail === 'object' && 'message' in detail) {
      const m = Reflect.get(detail, 'message'); if (typeof m === 'string') return m
    }
  }
  return fallback
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const rawText = await response.text()
  if (!rawText) return null
  try { return JSON.parse(rawText) } catch { return rawText }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = init.headers
    ? { 'Content-Type': 'application/json', ...init.headers }
    : { 'Content-Type': 'application/json' }
  const response = await fetch(`${API_ORIGIN}${path}`, { credentials: 'include', ...init, headers })
  const payload = await parseResponsePayload(response)
  if (!response.ok) throw new ApiError(getErrorMessage(payload, 'Request failed'), response.status)
  return payload as T
}

async function requestFormData<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, { method: 'POST', credentials: 'include', body: formData })
  const payload = await parseResponsePayload(response)
  if (!response.ok) throw new ApiError(getErrorMessage(payload, 'Request failed'), response.status)
  return payload as T
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export async function loginUser(p: LoginPayload): Promise<BackendUser> {
  return requestJson<BackendUser>(API_ENDPOINTS.auth.login, { method: 'POST', body: JSON.stringify(p) })
}
export async function registerUser(p: RegisterPayload): Promise<BackendUser> {
  return requestJson<BackendUser>(API_ENDPOINTS.auth.register, { method: 'POST', body: JSON.stringify(p) })
}
export async function fetchLegalStatus(): Promise<LegalStatusResponse | null> {
  try { return await requestJson<LegalStatusResponse>(API_ENDPOINTS.auth.legalStatus, { method: 'GET' }) } catch { return null }
}
export async function acceptLatestLegal(legalVersion: string = LEGAL_BUNDLE_VERSION): Promise<LegalStatusResponse> {
  return requestJson<LegalStatusResponse>(API_ENDPOINTS.auth.legalAccept, {
    method: 'POST', body: JSON.stringify({ legal_version: legalVersion }),
  })
}
export async function fetchCurrentUser(): Promise<BackendUser | null> {
  try { return await requestJson<BackendUser>(API_ENDPOINTS.auth.me, { method: 'GET' }) }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const refreshed = await refreshToken()
      if (!refreshed) return null
      try { return await requestJson<BackendUser>(API_ENDPOINTS.auth.me, { method: 'GET' }) } catch { return null }
    }
    return null
  }
}
export async function refreshToken(): Promise<boolean> {
  try { await requestJson<{ ok: boolean }>(API_ENDPOINTS.auth.refresh, { method: 'POST' }); return true }
  catch (error) { return !(error instanceof ApiError && error.status === 401) }
}
export async function logoutUser(): Promise<void> {
  await requestJson<{ ok: boolean }>(API_ENDPOINTS.auth.logout, { method: 'POST' })
}

// ── Admin API ─────────────────────────────────────────────────────────────────

export async function fetchAdminUsers(query: AdminUsersQuery = {}): Promise<AdminUsersPageResponse> {
  const params = new URLSearchParams()
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.role) params.set('role', query.role)
  if (typeof query.is_active === 'boolean') params.set('is_active', String(query.is_active))
  if (typeof query.limit === 'number') params.set('limit', String(query.limit))
  if (typeof query.offset === 'number') params.set('offset', String(query.offset))
  const suffix = params.toString()
  return requestJson<AdminUsersPageResponse>(
    suffix ? `${API_ENDPOINTS.admin.users}?${suffix}` : API_ENDPOINTS.admin.users, { method: 'GET' },
  )
}

// Suspend (is_active=false) or reinstate (is_active=true) a user account.
// Suspending cascade-revokes all their refresh tokens server-side (see
// admin.py's update_user_status) — the session ends within one refresh
// cycle (~30 min) rather than waiting for access-token expiry.
export async function updateUserStatus(userId: string, isActive: boolean): Promise<AdminUserRecord> {
  return requestJson<AdminUserRecord>(
    `${API_ENDPOINTS.admin.users}/${userId}/status`,
    { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) },
  )
}

export interface AdminStats {
  total_users: number
  active_users: number
  suspended_users: number
  total_admins: number
  inactive_count: number
  inactive_days_threshold: number
  inactive_buckets: Record<string, number>
  total_scenes: number
  public_scenes: number
}

export async function fetchAdminStats(inactiveDays = 30): Promise<AdminStats> {
  return requestJson<AdminStats>(`/admin/stats?inactive_days=${inactiveDays}`)
}

export async function fetchInactiveUsers(inactiveDays: number, limit = 20, offset = 0): Promise<AdminUsersPageResponse> {
  return requestJson<AdminUsersPageResponse>(
    `${API_ENDPOINTS.admin.users}/inactive?inactive_days=${inactiveDays}&limit=${limit}&offset=${offset}`,
  )
}

// ── Upload API ────────────────────────────────────────────────────────────────

export async function uploadMediaFile(payload: UploadMediaPayload): Promise<UploadMediaResponse> {
  const formData = new FormData()
  formData.set('file', payload.file); formData.set('folder', payload.folder)
  if (payload.sceneId) formData.set('scene_id', payload.sceneId)
  return requestFormData<UploadMediaResponse>(API_ENDPOINTS.upload.image, formData)
}

// ── Scene API (authoring) ─────────────────────────────────────────────────────

export async function fetchUserScenes(): Promise<SceneDetailRecord[]> {
  try {
    return await requestJson<SceneDetailRecord[]>(API_ENDPOINTS.scenes.root, { method: 'GET' })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const refreshed = await refreshToken()
      if (!refreshed) throw error
      return requestJson<SceneDetailRecord[]>(API_ENDPOINTS.scenes.root, { method: 'GET' })
    }
    throw error
  }
}
/**
 * Scenes the current user has played (has a scene_sessions row for) but doesn't
 * own. The backend only returns these while the scene is still public.
 */
export async function fetchPlayedScenes(): Promise<SceneDetailRecord[]> {
  try {
    return await requestJson<SceneDetailRecord[]>(`${API_ENDPOINTS.scenes.root}/played`, { method: 'GET' })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const refreshed = await refreshToken()
      if (!refreshed) throw error
      return requestJson<SceneDetailRecord[]>(`${API_ENDPOINTS.scenes.root}/played`, { method: 'GET' })
    }
    throw error
  }
}
export interface PublicScenesParams {
  search?: string
  nsfw?: 'sfw' | 'nsfw'
  tier?: 'free' | 'premium'
  game_mode?: 'normal' | 'survival'
  sort?: 'most_played' | 'newest' | 'oldest'
  page?: number
  page_size?: number
}
export async function fetchPublicScenes(params: PublicScenesParams = {}): Promise<SceneDetailRecord[]> {
  const query = new URLSearchParams()
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.nsfw) query.set('nsfw', params.nsfw)
  if (params.tier) query.set('tier', params.tier)
  if (params.game_mode) query.set('game_mode', params.game_mode)
  if (params.sort) query.set('sort', params.sort)
  if (typeof params.page === 'number') query.set('page', String(params.page))
  if (typeof params.page_size === 'number') query.set('page_size', String(params.page_size))
  const suffix = query.toString()
  return requestJson<SceneDetailRecord[]>(`${API_ENDPOINTS.scenes.root}/public/browse${suffix ? `?${suffix}` : ''}`, { method: 'GET' })
}
export async function getPublicScene(sceneId: string): Promise<SceneDetailRecord> {
  return requestJson<SceneDetailRecord>(`${API_ENDPOINTS.scenes.root}/public/${sceneId}`)
}
export async function getScene(sceneId: string): Promise<SceneDetailRecord> {
  return requestJson<SceneDetailRecord>(`${API_ENDPOINTS.scenes.root}/${sceneId}`)
}
/**
 * Fetches a scene for play. Tries the owned endpoint first (covers your own
 * private AND public stories), falls back to the public endpoint for
 * browsing other people's public stories. A 401/403 from the owned call
 * (not yours) falls through; a 404 from the public call means it truly
 * doesn't exist or isn't public.
 */
export async function getSceneForPlay(sceneId: string): Promise<SceneDetailRecord> {
  try {
    return await getScene(sceneId)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return await getPublicScene(sceneId)
    }
    throw error
  }
}
export async function createScene(payload: SceneCreatePayload): Promise<SceneRecord> {
  return requestJson<SceneRecord>(API_ENDPOINTS.scenes.root, { method: 'POST', body: JSON.stringify(payload) })
}
export async function createSceneCharacter(sceneId: string, payload: CharacterCreatePayload): Promise<CharacterRecord> {
  return requestJson<CharacterRecord>(`${API_ENDPOINTS.scenes.root}/${sceneId}/characters`, {
    method: 'POST', body: JSON.stringify(payload),
  })
}
export async function replaceCharacterExpressions(sceneId: string, characterId: string, expressions: ExpressionUpdateItem[]): Promise<CharacterRecord> {
  return requestJson<CharacterRecord>(
    `${API_ENDPOINTS.scenes.root}/${sceneId}/characters/${characterId}/expressions`,
    { method: 'PUT', body: JSON.stringify({ expressions }) },
  )
}
export async function updateCharacterAttributes(sceneId: string, characterId: string, attributes: AttributeUpdateItem[]): Promise<CharacterRecord> {
  return requestJson<CharacterRecord>(
    `${API_ENDPOINTS.scenes.root}/${sceneId}/characters/${characterId}/attributes`,
    { method: 'PUT', body: JSON.stringify({ attributes }) },
  )
}
// replaceCharacterRules() and createCharacterTrigger() were removed (2026-06)
// — they targeted /scenes/{id}/characters/{id}/rules and /triggers, routes
// that don't exist anywhere in scene.py (verified by reading the full file).
// Likely leftover from an earlier design that was superseded by the
// TRIGGER_PRESETS system (context_builder.py's evaluate_triggers), which
// derives behavior triggers from attribute values automatically instead of
// per-character custom rules. Confirmed unused: StepCharacters.tsx (the live
// character editor) has no rules/triggers UI at all.
export async function createSceneBackground(sceneId: string, payload: BackgroundCreatePayload): Promise<BackgroundRecord> {
  return requestJson<BackgroundRecord>(`${API_ENDPOINTS.scenes.root}/${sceneId}/backgrounds`, {
    method: 'POST', body: JSON.stringify(payload),
  })
}
export async function setSceneStartingBackground(sceneId: string, backgroundId: string): Promise<SceneRecord> {
  return requestJson<SceneRecord>(`${API_ENDPOINTS.scenes.root}/${sceneId}/starting-background`, {
    method: 'PUT', body: JSON.stringify({ background_id: backgroundId }),
  })
}

// ── Public background catalog ──────────────────────────────────────

export interface PublicBackgroundRecord {
  id: string; name: string; image_url: string; category: string | null; tags: string[]; created_at: string
}

export async function listPublicBackgrounds(category?: string): Promise<PublicBackgroundRecord[]> {
  return requestJson<PublicBackgroundRecord[]>(`/api/backgrounds/public${category ? `?category=${encodeURIComponent(category)}` : ''}`)
}

export async function addPublicBackgroundToScene(sceneId: string, publicBackgroundId: string): Promise<BackgroundRecord> {
  return requestJson<BackgroundRecord>(
    `${API_ENDPOINTS.scenes.root}/${sceneId}/backgrounds/from-public/${publicBackgroundId}`,
    { method: 'POST' },
  )
}

// ── Public user profile API ───────────────────────────────────────────────────
//
// No auth token required — backend routes have no get_current_user dependency.
// Routed by username, not user id, mirroring routers/users.py.

export interface PublicUserProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  profile_banner: string | null
  bio: string | null
  age: number | null
  joined_year: number
  tier: 'free' | 'premium'
  public_story_count: number
  total_plays: number
}

export async function fetchUserProfile(username: string): Promise<PublicUserProfile> {
  return requestJson<PublicUserProfile>(`${API_ENDPOINTS.users.root}/${encodeURIComponent(username)}/profile`)
}

export async function fetchUserPublicStories(username: string, params: PublicScenesParams = {}): Promise<SceneDetailRecord[]> {
  const query = new URLSearchParams()
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.nsfw) query.set('nsfw', params.nsfw)
  if (params.tier) query.set('tier', params.tier)
  if (params.game_mode) query.set('game_mode', params.game_mode)
  if (params.sort) query.set('sort', params.sort)
  if (typeof params.page === 'number') query.set('page', String(params.page))
  if (typeof params.page_size === 'number') query.set('page_size', String(params.page_size))
  const suffix = query.toString()
  return requestJson<SceneDetailRecord[]>(
    `${API_ENDPOINTS.users.root}/${encodeURIComponent(username)}/stories${suffix ? `?${suffix}` : ''}`,
  )
}

// ── Credits (TASK-011) ───────────────────────────────────────────────
//
// Rolling-window model: window_started_at/resets_at are null only if the
// user has never consumed a credit yet. session_cap is the caller's current
// tier cap (SESSION_CREDITS_FREE/PREMIUM) computed server-side.

export interface CreditsRecord {
  credits_remaining: number
  credits_lifetime_used: number
  window_started_at: string | null
  resets_at: string | null
  session_cap: number
}

export async function fetchCredits(): Promise<CreditsRecord> {
  return requestJson<CreditsRecord>('/api/credits')
}

// ── Session API (gameplay) ────────────────────────────────────────────────────

export async function getSessionByScene(sceneId: string): Promise<SessionRecord | null> {
  try {
    return await requestJson<SessionRecord>(`${API_ENDPOINTS.scenes.sessions}/by-scene/${sceneId}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function getLatestSessionByScene(sceneId: string): Promise<SessionRecord | null> {
  try {
    return await requestJson<SessionRecord>(`${API_ENDPOINTS.scenes.sessions}/latest/by-scene/${sceneId}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function getSession(sessionId: string): Promise<SessionRecord> {
  return requestJson<SessionRecord>(`${API_ENDPOINTS.scenes.sessions}/${sessionId}`)
}

/**
 * Backgrounds visible to a specific session: scene template backgrounds
 * plus any personalized (session-owned) ones. Needed for Personalized story
 * edit mode, which can't rely on SceneDetailRecord.backgrounds alone (that
 * only ever returns template backgrounds, never session-owned ones).
 */
export async function listSessionBackgrounds(sessionId: string): Promise<BackgroundRecord[]> {
  return requestJson<BackgroundRecord[]>(`${API_ENDPOINTS.scenes.sessions}/${sessionId}/backgrounds`)
}

export async function setSessionStartingBackground(sessionId: string, backgroundId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${API_ENDPOINTS.scenes.sessions}/${sessionId}/starting-background`, {
    method: 'PUT', body: JSON.stringify({ background_id: backgroundId }),
  })
}

/**
 * Deletes a background owned by this specific session (never a template
 * background — the backend rejects that). Backend enforces "a session must
 * have at least one background" (403 if this is the last one) and
 * auto-picks a fallback current_background_id if the deleted one was
 * active — see delete_session_background's docstring in scene.py.
 */
export async function deleteSessionBackground(sessionId: string, backgroundId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${API_ENDPOINTS.scenes.sessions}/${sessionId}/backgrounds/${backgroundId}`, { method: 'DELETE' })
}

export async function startSession(sceneId: string): Promise<SessionRecord> {
  return requestJson<SessionRecord>(`${API_ENDPOINTS.scenes.sessions}/start`, {
    method: 'POST', body: JSON.stringify({ scene_id: sceneId }),
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${API_ENDPOINTS.scenes.sessions}/${sessionId}`, { method: 'DELETE' })
}

export async function deleteScene(sceneId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${API_ENDPOINTS.scenes.root}/${sceneId}`, { method: 'DELETE' })
}

export async function getActiveSessionId(sceneId: string): Promise<string | null> {
  const session = await getSessionByScene(sceneId)
  return session?.id ?? null
}

export async function submitTurn(payload: TurnRequest): Promise<TurnResponseRecord> {
  return requestJson<TurnResponseRecord>(`${API_ENDPOINTS.scenes.sessions}/turn`, {
    method: 'POST', body: JSON.stringify(payload),
  })
}

export async function redoTurn(sessionId: string): Promise<TurnResponseRecord> {
  return requestJson<TurnResponseRecord>(`${API_ENDPOINTS.scenes.sessions}/${sessionId}/redo`, { method: 'POST' })
}

// resetSession() removed (2026-06) — TASK-003 replaced the in-place
// "reset" mechanism (which never deleted/recreated the SceneSession row)
// with a real Restart: deleteSession(id) → startSession(sceneId) → reload.
// See StoryPage.tsx's handleRestart. The backend's POST /sessions/{id}/reset
// route is removed alongside this.

// ── Lore chunks (authoring) ──────────────────────────────────────────────────

export interface LoreChunkRecord {
  id: string; scene_id: string | null; character_id: string | null
  content: string; chunk_type: 'world' | 'rule' | 'character' | 'event'; priority: number; created_at: string
}

export interface LoreChunkCreatePayload {
  content: string; chunk_type: 'world' | 'rule' | 'character' | 'event'; priority: number
}

export async function listSceneLore(sceneId: string): Promise<LoreChunkRecord[]> {
  return requestJson<LoreChunkRecord[]>(`${API_ENDPOINTS.scenes.root}/${sceneId}/lore`)
}
export async function createSceneLore(sceneId: string, payload: LoreChunkCreatePayload): Promise<LoreChunkRecord> {
  return requestJson<LoreChunkRecord>(`${API_ENDPOINTS.scenes.root}/${sceneId}/lore`, { method: 'POST', body: JSON.stringify(payload) })
}
export async function deleteSceneLore(sceneId: string, loreId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${API_ENDPOINTS.scenes.root}/${sceneId}/lore/${loreId}`, { method: 'DELETE' })
}
export async function listCharacterLore(sceneId: string, characterId: string): Promise<LoreChunkRecord[]> {
  return requestJson<LoreChunkRecord[]>(`${API_ENDPOINTS.scenes.root}/${sceneId}/characters/${characterId}/lore`)
}
export async function createCharacterLore(sceneId: string, characterId: string, payload: LoreChunkCreatePayload): Promise<LoreChunkRecord> {
  return requestJson<LoreChunkRecord>(`${API_ENDPOINTS.scenes.root}/${sceneId}/characters/${characterId}/lore`, { method: 'POST', body: JSON.stringify(payload) })
}
export async function deleteCharacterLore(sceneId: string, characterId: string, loreId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${API_ENDPOINTS.scenes.root}/${sceneId}/characters/${characterId}/lore/${loreId}`, { method: 'DELETE' })
}

// ── Scene start choices (authoring) ──────────────────────────────────────────

export interface SceneStartChoiceRecord {
  id: string; scene_id: string; choice_text: string; display_order: number; created_at: string
}
export interface SceneStartChoicePayload {
  choice_text: string; display_order: number
}

export async function listStartChoices(sceneId: string): Promise<SceneStartChoiceRecord[]> {
  return requestJson<SceneStartChoiceRecord[]>(`${API_ENDPOINTS.scenes.root}/${sceneId}/start-choices`)
}
export async function getPublicStartChoices(sceneId: string): Promise<SceneStartChoiceRecord[]> {
  return requestJson<SceneStartChoiceRecord[]>(`${API_ENDPOINTS.scenes.root}/public/${sceneId}/start-choices`)
}
export async function listStartChoicesForPlay(sceneId: string): Promise<SceneStartChoiceRecord[]> {
  try {
    return await listStartChoices(sceneId)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return await getPublicStartChoices(sceneId)
    }
    throw error
  }
}
export async function createStartChoice(sceneId: string, payload: SceneStartChoicePayload): Promise<SceneStartChoiceRecord> {
  return requestJson<SceneStartChoiceRecord>(`${API_ENDPOINTS.scenes.root}/${sceneId}/start-choices`, { method: 'POST', body: JSON.stringify(payload) })
}
export async function updateStartChoice(sceneId: string, choiceId: string, payload: SceneStartChoicePayload): Promise<SceneStartChoiceRecord> {
  return requestJson<SceneStartChoiceRecord>(`${API_ENDPOINTS.scenes.root}/${sceneId}/start-choices/${choiceId}`, { method: 'PUT', body: JSON.stringify(payload) })
}
export async function deleteStartChoice(sceneId: string, choiceId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${API_ENDPOINTS.scenes.root}/${sceneId}/start-choices/${choiceId}`, { method: 'DELETE' })
}

export interface StreamChatCallbacks {
  onToken: (token: string) => void; onDone: () => void; onError: (message: string) => void
}

export async function streamChatMessage(prompt: string, tier: string = 'free', callbacks: StreamChatCallbacks): Promise<void> {
  const { onToken, onDone, onError } = callbacks
  let response: Response
  try {
    response = await fetch(`${API_ORIGIN}/api/ai/chat/stream`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, tier }),
    })
  } catch (err) { onError(err instanceof Error ? err.message : 'Network error'); return }
  if (!response.ok || !response.body) { onError(`Server error ${response.status}`); return }
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n'); buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.trim(); if (!line.startsWith('data:')) continue
        const jsonStr = line.slice('data:'.length).trim(); if (!jsonStr) continue
        let event: Record<string, unknown>
        try { event = JSON.parse(jsonStr) } catch { continue }
        if (typeof event.token === 'string') onToken(event.token)
        else if (event.done === true) { onDone(); return }
        else if (typeof event.error === 'string') { onError(event.error); return }
      }
    }
  } finally { reader.releaseLock() }
  onDone()
}

export async function fetchChatMessage(prompt: string, tier: string = 'free'): Promise<string> {
  const response = await requestJson<ChatResponse>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ prompt, tier }) })
  return response.text.trim()
}

// ── Streaming turn API ────────────────────────────────────────────────────────
//
// streamTurn() and commitTurn() were removed (2026-06). They targeted the old
// two-request stream-then-commit contract: POST /sessions/turn/stream sent
// SSE tokens only, then a separate POST /sessions/turn/commit (now deleted
// from the backend) persisted the turn using the client's echoed full_response
// text. The backend collapsed this into a single request — POST
// /sessions/turn/stream now persists the turn itself once streaming finishes
// and sends the result as a final SSE event shaped like TurnResponseRecord
// (`{done: true, turn: {...}}`), not a raw `full_response` string.
//
// Verified unused before removal: every gameplay path (StoryPage.tsx →
// submitTurn() → POST /sessions/turn) goes through the non-streaming
// endpoint; ChoicePanel.tsx and DialogueBox.tsx have no API calls of their
// own. If streaming is wired into the UI later, build it fresh against the
// current single-event contract rather than resurrecting these.

// ── Scene edit API ────────────────────────────────────────────────────────────

export interface SceneUpdatePayload {
  title?: string; description?: string | null; game_mode?: 'normal' | 'survival'
  is_nsfw?: boolean; tier?: 'free' | 'premium'; is_public?: boolean
  // TASK-008: optional client-side auto-generated cover. Omit/null leaves
  // the existing scene_cover untouched (backend partial-update semantics —
  // see update_scene's docstring comment in scene.py).
  scene_cover?: string | null
}

export async function updateScene(sceneId: string, payload: SceneUpdatePayload): Promise<SceneRecord> {
  // PUT, not PATCH — the route accepts a genuinely partial SceneUpdateRequest.
  return requestJson<SceneRecord>(`${API_ENDPOINTS.scenes.root}/${sceneId}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export interface CharacterUpdatePayload {
  name?: string; description?: string; avatar_url?: string | null; position?: number; initial_dialogue?: string | null
}

export async function updateSceneCharacter(sceneId: string, characterId: string, payload: CharacterUpdatePayload): Promise<CharacterRecord> {
  // PUT, not PATCH — matches scene.py's update_character route. Note the
  // backend's CharacterCreateRequest requires name+description (not
  // optional there, despite CharacterUpdatePayload marking them optional
  // here) — every current call site (useSceneSubmit.ts) already supplies
  // both, so this is a latent type-looseness, not an active bug, but worth
  // knowing if a future partial-update call site is added.
  return requestJson<CharacterRecord>(`${API_ENDPOINTS.scenes.root}/${sceneId}/characters/${characterId}`, { method: 'PUT', body: JSON.stringify(payload) })
}
export async function deleteSceneCharacter(sceneId: string, characterId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${API_ENDPOINTS.scenes.root}/${sceneId}/characters/${characterId}`, { method: 'DELETE' })
}
export async function deleteSceneBackground(sceneId: string, backgroundId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${API_ENDPOINTS.scenes.root}/${sceneId}/backgrounds/${backgroundId}`, { method: 'DELETE' })
}
// replaceStartChoices() removed (2026-06) — targeted /start-choices/replace,
// a bulk-update route that doesn't exist in scene.py (only individual
// create/update/delete-per-choice routes are defined). Confirmed unused:
// StartChoicesEditor.tsx (the live editor) reorders by calling
// updateStartChoice() individually per choice via Promise.all instead.

// ── Session character API (Personalized story edit mode) ──────────────────────
//
// Mirrors the Original-mode character functions above, but targets a
// session's OWN characters instead of the scene's template characters —
// see scene.py's create_session_character / update_session_character /
// delete_session_character for the exact backend semantics, especially the
// rule that template-derived characters (is_session_only: false) can be
// edited here but never deleted.

export interface SessionCharacterCreatePayload {
  name: string; description: string; avatar_url?: string | null; position?: number; initial_dialogue?: string | null
}
export interface SessionCharacterUpdatePayload {
  name: string; description: string; avatar_url?: string | null; position?: number; initial_dialogue?: string | null
}
export interface SessionCharacterAttributeUpdateItem { attr_key: string; initial_value: number }
export interface SessionCharacterExpressionUpdateItem { slot_key: string; display_name: string; image_url: string | null }

export async function createSessionCharacter(sessionId: string, payload: SessionCharacterCreatePayload): Promise<SessionCharacterRecord> {
  return requestJson<SessionCharacterRecord>(`${API_ENDPOINTS.scenes.sessions}/${sessionId}/characters`, {
    method: 'POST', body: JSON.stringify(payload),
  })
}
export async function updateSessionCharacter(sessionId: string, sessionCharacterId: string, payload: SessionCharacterUpdatePayload): Promise<SessionCharacterRecord> {
  return requestJson<SessionCharacterRecord>(`${API_ENDPOINTS.scenes.sessions}/${sessionId}/characters/${sessionCharacterId}`, {
    method: 'PUT', body: JSON.stringify(payload),
  })
}
export async function deleteSessionCharacter(sessionId: string, sessionCharacterId: string): Promise<void> {
  // 403 if sessionCharacterId is template-derived (is_session_only: false) —
  // callers should only offer a remove action for session-only characters.
  await requestJson<{ ok: boolean }>(`${API_ENDPOINTS.scenes.sessions}/${sessionId}/characters/${sessionCharacterId}`, { method: 'DELETE' })
}
export async function updateSessionCharacterAttributes(sessionId: string, sessionCharacterId: string, attributes: SessionCharacterAttributeUpdateItem[]): Promise<SessionCharacterRecord> {
  return requestJson<SessionCharacterRecord>(
    `${API_ENDPOINTS.scenes.sessions}/${sessionId}/characters/${sessionCharacterId}/attributes`,
    { method: 'PUT', body: JSON.stringify({ attributes }) },
  )
}
export async function replaceSessionCharacterExpressions(sessionId: string, sessionCharacterId: string, expressions: SessionCharacterExpressionUpdateItem[]): Promise<SessionCharacterRecord> {
  return requestJson<SessionCharacterRecord>(
    `${API_ENDPOINTS.scenes.sessions}/${sessionId}/characters/${sessionCharacterId}/expressions`,
    { method: 'PUT', body: JSON.stringify({ expressions }) },
  )
}

// ── Game / Hub (TASK-011) ──────────────────────────────────────────────
//
// Separate currency system from Credits above: coins/gems are player-facing
// gamification currency (daily login, quests), not the AI-turn budget.

export interface GameProfileRecord {
  user_id: string
  coins: number
  gems: number
  last_daily_claimed_at: string | null
}

export interface DailyClaimRecord {
  success: boolean
  coins_awarded: number
  new_coin_balance: number
  next_claimable_at: string
  message: string
}

export async function fetchGameProfile(): Promise<GameProfileRecord> {
  return requestJson<GameProfileRecord>('/api/game/profile')
}

export async function claimDailyReward(): Promise<DailyClaimRecord> {
  return requestJson<DailyClaimRecord>('/api/game/daily/claim', { method: 'POST' })
}
