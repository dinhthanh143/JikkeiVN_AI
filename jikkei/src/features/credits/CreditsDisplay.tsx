// TASK-011 — shared credits readout used in both the Settings → Subscription
// tab and in-game (StoryPage). Display rule matches Claude's own usage-limit
// UI: a plain count while credits remain, and "Unavailable until X" instead
// of a countdown the instant it hits 0.
import { formatResetTime } from './formatResetTime'
import type { CreditsRecord } from '@/services/backendApi'

interface CreditsDisplayProps {
  credits: CreditsRecord | null
  className?: string
}

export default function CreditsDisplay({ credits, className }: CreditsDisplayProps) {
  if (!credits) return null

  const exhausted = credits.credits_remaining <= 0

  return (
    <span className={className}>
      {exhausted
        ? credits.resets_at
          ? `Unavailable until ${formatResetTime(credits.resets_at)}`
          : 'Unavailable'
        : `✦ ${credits.credits_remaining}/${credits.session_cap}`}
    </span>
  )
}
