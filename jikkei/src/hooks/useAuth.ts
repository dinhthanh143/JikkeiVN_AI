import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, type LoginPayload, type UserSettings } from '@/services/authService'
import { fetchCredits, type CreditsRecord } from '@/services/backendApi'
import { usePlayerStore } from '@/store/usePlayerStore'
import { useAudioStore } from '@/store/useAudioStore'
import type { ApiError } from '@/services/api'

function applySettingsToAudio(s: UserSettings) {
  useAudioStore.getState().applyUserSettings({
    bgm_volume:       s.bgm_volume,
    bgm_enabled:      s.bgm_enabled,
    sfx_volume:       s.sfx_volume,
    sfx_enabled:      s.sfx_enabled,
    text_sfx_enabled: s.text_sfx_enabled,
    text_sfx_volume:  s.text_sfx_volume,
    text_sfx_type:    s.text_sfx_type,
  })
}

// TASK-011 follow-up: fetch credits once per session-establishing event and
// stash it in usePlayerStore, instead of every component that displays
// credits fetching it on its own mount. Non-fatal on failure, same as the
// settings fetch right next to each call site below — a user without
// credits loaded yet just sees the loading state a beat longer.
async function loadCredits(setCredits: (c: CreditsRecord | null) => void) {
  try {
    setCredits(await fetchCredits())
  } catch {
    // Non-fatal — consumers treat null as "still loading".
  }
}

export function useAuth() {
  const { user, isLoading, isInitialized, setUser, setLoading, setInitialized, clearUser, setSettings, setCredits } = usePlayerStore()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const initializingRef = useRef(false)

  const initialize = useCallback(async () => {
    if (isInitialized || initializingRef.current) return
    initializingRef.current = true
    try {
      const currentUser = await authService.me()
      setUser(currentUser)
      void loadCredits(setCredits)
      try {
        const settings = await authService.getSettings()
        setSettings(settings)
        applySettingsToAudio(settings)
      } catch {
        // Non-fatal — audio store keeps defaults.
      }
    } catch {
      clearUser()
    } finally {
      setInitialized()
      initializingRef.current = false
    }
  }, [clearUser, isInitialized, setCredits, setInitialized, setSettings, setUser])

  const login = useCallback(
    async (identifier: string, password: string) => {
      setError(null)
      setLoading(true)
      try {
        const isEmail = identifier.includes('@')
        const payload: LoginPayload = {
          password,
          ...(isEmail ? { email: identifier } : { username: identifier }),
        }
        const currentUser = await authService.login(payload)
        setUser(currentUser)
        void loadCredits(setCredits)
        try {
          const settings = await authService.getSettings()
          setSettings(settings)
          applySettingsToAudio(settings)
        } catch {
          // Non-fatal.
        }
        navigate(currentUser.role === 'admin' ? '/admin/overview' : '/')
      } catch (err) {
        const apiErr = err as ApiError
        if (apiErr.status === 401) {
          setError('Invalid email or password')
        } else if (apiErr.status === 400) {
          // OAuth-only account trying password login — backend sends a
          // specific "use Google sign-in" message here, surface it as-is.
          setError(typeof apiErr.detail === 'string' ? apiErr.detail : 'This account uses a different sign-in method.')
        } else if (apiErr.status === 429) {
          const detail = apiErr.detail
          setError(typeof detail === 'string' && detail.toLowerCase().includes('locked')
            ? detail
            : 'Too many attempts. Please wait before trying again.')
        } else {
          setError('Something went wrong. Please try again.')
        }
        throw err
      } finally {
        setLoading(false)
      }
    },
    [navigate, setLoading, setCredits, setSettings, setUser],
  )

  const register = useCallback(
    async (email: string, password: string, username: string, displayName?: string, dateOfBirth?: string) => {
      setError(null)
      setLoading(true)
      try {
        const currentUser = await authService.register({
          email,
          password,
          username,
          display_name: displayName || undefined,
          date_of_birth: dateOfBirth || undefined,
        })
        setUser(currentUser)
        void loadCredits(setCredits)
        navigate('/')
      } catch (err) {
        const apiErr = err as ApiError
        if (apiErr.status === 400) setError('Email or username already taken')
        else if (apiErr.status === 422) setError('Please check your input and try again')
        else setError('Registration failed. Please try again.')
        throw err
      } finally {
        setLoading(false)
      }
    },
    [navigate, setLoading, setCredits, setUser],
  )

  /** Final step of Google signup — this is the call that actually creates
   *  the users row. Everything before this (the OAuth callback) only held
   *  the identity in a signed cookie. */
  const completeOAuthRegistration = useCallback(
    async (username: string, displayName?: string) => {
      setError(null)
      setLoading(true)
      try {
        const currentUser = await authService.completeOAuthRegistration({
          username,
          display_name: displayName || undefined,
        })
        setUser(currentUser)
        void loadCredits(setCredits)
        navigate('/')
      } catch (err) {
        const apiErr = err as ApiError
        if (apiErr.status === 400) setError('Username already taken, or this signup was already completed')
        else if (apiErr.status === 401) setError('Your Google signup session expired. Please try again.')
        else if (apiErr.status === 422) setError('Please check your input and try again')
        else setError('Registration failed. Please try again.')
        throw err
      } finally {
        setLoading(false)
      }
    },
    [navigate, setLoading, setCredits, setUser],
  )

  const logout = useCallback(async () => {
    try { await authService.logout() }
    finally { clearUser(); navigate('/auth') }
  }, [clearUser, navigate])

  return {
    user, isLoading, isInitialized, error,
    login, register, logout, initialize, completeOAuthRegistration,
    isLoggedIn: !!user,
    isAdmin: user?.role === 'admin',
    isAuthenticated: !!user,
    authResolved: isInitialized,
    userId: user?.id ?? null,
    username: user?.username ?? null,
    role: user?.role ?? null,
    tier: user?.tier ?? 'free',
    isPremium: user?.tier === 'premium',
  }
}
