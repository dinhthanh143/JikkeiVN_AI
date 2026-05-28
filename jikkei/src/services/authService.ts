import api from './api'
import type { User } from '@/types/user'
import type { LoginPayload as BackendLoginPayload } from './backendApi'

export type LoginPayload = BackendLoginPayload

export interface RegisterPayload {
  email: string
  password: string
  username: string
  display_name?: string
  date_of_birth?: string  // ISO date string: "YYYY-MM-DD"
}

/** Returned by GET /auth/oauth/pending — identity Google already confirmed,
 *  before any users row exists. Used to prefill the finish-signup form. */
export interface OAuthPendingInfo {
  provider: string
  email: string
  suggested_username: string
  display_name: string | null
}

/** Submitted to POST /auth/oauth/complete — this is what actually creates the row. */
export interface OAuthCompleteRegistrationPayload {
  username: string
  display_name?: string
}

/** Mirrors User.settings JSONB — volumes are 0-100 integers */
export interface UserSettings {
  sfx_volume: number
  bgm_volume: number
  sfx_enabled: boolean
  bgm_enabled: boolean
  auto_play: boolean
  language: string
  text_sfx_enabled: boolean
  text_sfx_volume: number   // 0-100
  text_sfx_type: 1 | 2 | 3
}

export type UserSettingsUpdatePayload = Partial<UserSettings>

export const authService = {
  async login(payload: LoginPayload): Promise<User> {
    const res = await api.post<User>('/auth/login', payload)
    return res.data
  },

  async register(payload: RegisterPayload): Promise<User> {
    const res = await api.post<User>('/auth/register', payload)
    return res.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async logoutAll(): Promise<void> {
    await api.post('/auth/logout-all')
  },

  async me(): Promise<User> {
    const res = await api.get<User>('/auth/me')
    return res.data
  },

  async refresh(): Promise<void> {
    await api.post('/auth/refresh')
  },

  async getSettings(): Promise<UserSettings> {
    const res = await api.get<UserSettings>('/auth/settings')
    return res.data
  },

  async updateSettings(payload: UserSettingsUpdatePayload): Promise<UserSettings> {
    const res = await api.patch<UserSettings>('/auth/settings', payload)
    return res.data
  },

  /** Reads the signed pending-signup cookie the OAuth callback set. 401 means
   *  no/expired pending signup — the caller should send the user back to /auth. */
  async getOAuthPendingInfo(): Promise<OAuthPendingInfo> {
    const res = await api.get<OAuthPendingInfo>('/auth/oauth/pending')
    return res.data
  },

  /** Creates the users row for real. Nothing was written to the DB until this call. */
  async completeOAuthRegistration(payload: OAuthCompleteRegistrationPayload): Promise<User> {
    const res = await api.post<User>('/auth/oauth/complete', payload)
    return res.data
  },
}
