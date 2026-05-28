// TASK-011 — wired to real data via the shared useCredits() hook (see
// AccountTab.tsx). Previously showed useAccountData's mock; that mock is
// now removed since this is its only consumer.
import type { CreditsRecord } from '@/services/backendApi'
import { formatResetTime } from '@/features/credits/formatResetTime'

type Props = {
  data: CreditsRecord | null
  isLoading: boolean
}

function formatWindowStarted(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function CreditsCard({ data, isLoading }: Props) {
  const exhausted = !!data && data.credits_remaining <= 0

  return (
    <article className="settings-card settings-credits-card">
      <p className="settings-kicker">CREDITS</p>

      {isLoading ? (
        <div className="settings-skeleton-block" aria-hidden="true" />
      ) : data ? (
        exhausted ? (
          <>
            <div className="settings-credits-display settings-credits-display--exhausted">
              <span className="settings-credits-unavailable">
                Unavailable{data.resets_at ? ` until ${formatResetTime(data.resets_at)}` : ''}
              </span>
            </div>
            <p className="settings-subtext">
              {data.credits_lifetime_used.toLocaleString()} used lifetime
            </p>
          </>
        ) : (
          <>
            <div className="settings-credits-display">
              <span className="settings-credits-value">{data.credits_remaining}</span>
              <span className="settings-credits-unit">/ {data.session_cap} remaining</span>
            </div>
            <p className="settings-subtext">
              {data.credits_lifetime_used.toLocaleString()} used lifetime
            </p>
            {data.window_started_at && (
              <p className="settings-subtext settings-subtext--muted">
                Current window started: {formatWindowStarted(data.window_started_at)}
              </p>
            )}
          </>
        )
      ) : (
        <p className="settings-subtext settings-subtext--muted">—</p>
      )}
    </article>
  )
}
