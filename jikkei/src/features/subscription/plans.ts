import type { PlanDefinition } from './types'

// Single source of truth for the two tiers. Edit copy/price here only.
export const PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'FREE',
    priceLabel: '$0',
    priceSuffix: '/forever',
    tagline: 'Everything you need to get started',
    features: [
      'Daily credit allowance',
      'Access to all base characters',
      'Standard generation speed',
      'Community gallery access',
    ],
  },
  {
    id: 'premium',
    name: 'PREMIUM',
    priceLabel: '$7',
    priceSuffix: '/month',
    tagline: 'For players who want more, faster',
    features: [
      'Unlimited generation credits',
      'Priority queue — skip the wait',
      'Early access to new characters',
      'Premium-only badge & flair',
      'Cancel anytime',
    ],
  },
]
