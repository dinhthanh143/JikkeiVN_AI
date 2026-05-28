// TASK-12.3 — currency balance strip. Unlike the other marketplace hooks,
// this one is real (not mock) from day one — GET /api/game/profile already
// exists and useDailyClaim.ts (Hub) proves the pattern out.
import { useEffect, useState } from 'react'
import { fetchGameProfile, type GameProfileRecord } from '@/services/backendApi'

export function useMarketBalance() {
  const [profile, setProfile] = useState<GameProfileRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchGameProfile()
      .then((p) => { if (!cancelled) setProfile(p) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { coins: profile?.coins ?? 0, gems: profile?.gems ?? 0, loading }
}
