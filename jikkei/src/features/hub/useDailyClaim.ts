// TASK-011 (The Hub) — fetches the user's game profile, exposes claim() and
// a live countdown to the next available claim. Mirrors useCredits.ts's
// shape (fetch-on-mount + refetch) but adds the countdown timer since daily
// claims are cooldown-gated rather than a simple balance.
import { useCallback, useEffect, useState } from 'react'
import { claimDailyReward, fetchGameProfile, type GameProfileRecord } from '@/services/backendApi'

const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000

export function useDailyClaim() {
  const [profile, setProfile] = useState<GameProfileRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secondsUntilNext, setSecondsUntilNext] = useState<number | null>(null)

  const fetchProfile = useCallback(async () => {
    try {
      setProfile(await fetchGameProfile())
    } catch {
      setError('Could not load your game profile.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchProfile() }, [fetchProfile])

  useEffect(() => {
    if (!profile?.last_daily_claimed_at) { setSecondsUntilNext(null); return }
    const tick = () => {
      const nextAt = new Date(profile.last_daily_claimed_at!).getTime() + CLAIM_COOLDOWN_MS
      setSecondsUntilNext(Math.max(0, Math.floor((nextAt - Date.now()) / 1000)))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [profile?.last_daily_claimed_at])

  const canClaim = secondsUntilNext === null || secondsUntilNext === 0

  const claim = useCallback(async () => {
    if (!canClaim || claiming) return
    setClaiming(true)
    setError(null)
    try {
      const result = await claimDailyReward()
      setProfile((prev) => prev ? { ...prev, coins: result.new_coin_balance, last_daily_claimed_at: new Date().toISOString() } : prev)
    } catch {
      setError('Failed to claim daily. Try again.')
      void fetchProfile() // re-sync in case our local cooldown state drifted
    } finally {
      setClaiming(false)
    }
  }, [canClaim, claiming, fetchProfile])

  const countdownDisplay = secondsUntilNext !== null && secondsUntilNext > 0
    ? [Math.floor(secondsUntilNext / 3600), Math.floor((secondsUntilNext % 3600) / 60), secondsUntilNext % 60]
        .map((n) => String(n).padStart(2, '0')).join(':')
    : null

  return { profile, loading, claiming, canClaim, claim, countdownDisplay, error }
}
