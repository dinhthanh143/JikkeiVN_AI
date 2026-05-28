// TASK-011 follow-up — this used to fetch-on-mount itself (causing a
// loading flash every time SubscriptionTab/AccountTab/StoryPage mounted).
// Credits now live in usePlayerStore, fetched once during AuthInitializer's
// bootstrap (see useAuth.ts) — this hook is just a thin selector over that
// store so every consumer reads the same already-resolved data instantly.
// Same public API as before (`credits`, `refetch`, `decrement`) so no
// consumer needed to change.
import { useCallback } from 'react'
import { usePlayerStore } from '@/store/usePlayerStore'
import { fetchCredits } from '@/services/backendApi'

export function useCredits() {
  const credits = usePlayerStore((s) => s.credits)
  const setCredits = usePlayerStore((s) => s.setCredits)
  const decrement = usePlayerStore((s) => s.decrementCredits)

  // Used after a 429 (CreditsExhaustedModal needs the server's authoritative
  // resets_at) or anywhere else that needs to force a fresh read.
  const refetch = useCallback(async () => {
    try {
      const data = await fetchCredits()
      setCredits(data)
      return data
    } catch (err) {
      console.error('[useCredits] refetch error:', err)
      return null
    }
  }, [setCredits])

  return { credits, refetch, decrement }
}
