import { useCallback, useState } from 'react'
import { usePlayerStore } from '@/store/usePlayerStore'
import type { Tier } from './types'

// ─────────────────────────────────────────────────────────────────────────
// useSubscription
//
// Source of truth for the user's CURRENT tier is real: `user.tier` on
// usePlayerStore (see src/types/user.ts). Nothing about that is mocked.
//
// What IS mocked: the upgrade/checkout flow. There is no payment provider
// wired up yet, so `upgrade()` just simulates a brief pending state and
// resolves — it does NOT call any backend and does NOT mutate `user.tier`
// (that should only ever change in response to a real, server-confirmed
// subscription event). Swap the body of `upgrade()` for a real checkout
// redirect / API call when that's ready (e.g. Stripe Checkout session).
// ─────────────────────────────────────────────────────────────────────────

export type UpgradeState = 'idle' | 'pending' | 'success' | 'error'

export function useSubscription() {
  const user = usePlayerStore((s) => s.user)
  const currentTier: Tier = user?.tier ?? 'free'
  const [upgradeState, setUpgradeState] = useState<UpgradeState>('idle')

  const upgrade = useCallback(async (_targetTier: Tier) => {
    // MOCK — replace with real checkout (e.g. redirect to Stripe Checkout,
    // or POST /api/subscription/checkout) once a payment provider exists.
    setUpgradeState('pending')
    await new Promise((r) => setTimeout(r, 900))
    setUpgradeState('success')
    setTimeout(() => setUpgradeState('idle'), 1800)
  }, [])

  const manage = useCallback(() => {
    // MOCK — replace with a real billing-portal redirect
    // (e.g. Stripe customer portal) once a payment provider exists.
    setUpgradeState('pending')
    setTimeout(() => setUpgradeState('idle'), 600)
  }, [])

  return { currentTier, upgradeState, upgrade, manage }
}
