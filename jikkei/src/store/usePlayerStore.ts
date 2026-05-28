import { create } from 'zustand'
import type { User } from '@/types/user'
import type { UserSettings } from '@/services/authService'
import type { CreditsRecord } from '@/services/backendApi'

interface PlayerState {
  user: User | null
  isLoading: boolean
  isInitialized: boolean
  settings: UserSettings | null
  // TASK-011 follow-up: credits now live here instead of being fetched by
  // every component that displays them (Settings → Account tab, Settings →
  // Subscription tab, in-game StoryPage badge). Fetched once during
  // AuthInitializer's bootstrap (see useAuth.ts's initialize/login/register)
  // so all three consumers read the same already-resolved data with no
  // per-mount fetch/loading flash.
  credits: CreditsRecord | null
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setInitialized: () => void
  clearUser: () => void
  setSettings: (settings: UserSettings | null) => void
  /** Optimistic partial update — merges into existing settings without a network call */
  updateSettingsLocal: (partial: Partial<UserSettings> | UserSettings) => void
  setCredits: (credits: CreditsRecord | null) => void
  /** Optimistic — call right after a turn/redo succeeds, before the next refetch. */
  decrementCredits: () => void
}

export const usePlayerStore = create<PlayerState>((set) => {
  if (typeof window !== 'undefined') {
    window.addEventListener('jikkei:session-expired', () => {
      set({ user: null, isInitialized: true, settings: null, credits: null })
    })
  }

  return {
    user: null,
    isLoading: false,
    isInitialized: false,
    settings: null,
    credits: null,
    setUser: (user) => set({ user }),
    setLoading: (isLoading) => set({ isLoading }),
    setInitialized: () => set({ isInitialized: true }),
    clearUser: () => set({ user: null, settings: null, credits: null }),
    setSettings: (settings) => set({ settings }),
    updateSettingsLocal: (partial) =>
      set((state) => ({
        settings: state.settings
          ? { ...state.settings, ...partial }
          : (partial as UserSettings),
      })),
    setCredits: (credits) => set({ credits }),
    decrementCredits: () =>
      set((state) => ({
        credits: state.credits
          ? { ...state.credits, credits_remaining: Math.max(0, state.credits.credits_remaining - 1) }
          : state.credits,
      })),
  }
})
