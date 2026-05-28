// ─────────────────────────────────────────────────────────────────────────
// Subscription feature — types
//
// Deliberately decoupled from `features/settings`. The only external
// dependency this feature has is the `tier` field already present on
// `usePlayerStore().user` (see src/types/user.ts — `tier: 'free' | 'premium'`).
// ─────────────────────────────────────────────────────────────────────────

export type Tier = 'free' | 'premium'

export interface PlanDefinition {
  id: Tier
  name: string
  priceLabel: string
  priceSuffix: string
  tagline: string
  features: string[]
}
