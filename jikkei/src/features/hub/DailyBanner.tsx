// TASK-011 — the daily coin claim card. Amber/gold accent for currency
// mirrors the existing --pink premium-tier badge treatment (HomePage.css
// .user-tier-premium) rather than inventing a new palette.
import { useDailyClaim } from './useDailyClaim'
import { playClick } from '@/audio/sfx'

const DAILY_AMOUNT = Number(import.meta.env.VITE_DAILY_COIN_AMOUNT) || 20

export default function DailyBanner() {
  const { profile, loading, claiming, canClaim, claim, countdownDisplay, error } = useDailyClaim()

  if (loading) return <div className="hub-daily-banner hub-daily-banner-skeleton" />

  return (
    <div className={`hub-daily-banner ${canClaim ? 'hub-daily-banner-ready' : ''}`}>
      <div className="hub-daily-inner">
        <p className="hub-daily-kicker">// DAILY_REWARD</p>
        <h2 className="hub-daily-title">
          {canClaim ? 'Your Daily Coins Await' : 'Come Back Tomorrow'}
        </h2>
        <div className="hub-daily-reward-row">
          <span className="hub-daily-coin-icon">◈</span>
          <span className="hub-daily-amount">+{DAILY_AMOUNT}</span>
          <span className="hub-daily-currency">COINS</span>
        </div>
        <div className="hub-daily-sep" />
        <div className="hub-daily-bottom">
          <div>
            {profile && (
              <p className="hub-daily-balance">
                Balance: <strong>{profile.coins.toLocaleString()}</strong> coins
                {profile.gems > 0 && <> · <strong>{profile.gems.toLocaleString()}</strong> gems</>}
              </p>
            )}
            {error && <p className="hub-daily-error">{error}</p>}
          </div>
          {canClaim ? (
            <button
              type="button"
              className="hub-daily-claim-btn"
              onClick={() => { playClick(); void claim() }}
              disabled={claiming}
            >
              {claiming ? 'Claiming...' : 'Claim Daily Coins'}
            </button>
          ) : (
            <div className="hub-daily-countdown-wrap">
              <p className="hub-daily-countdown-label">Next claim in</p>
              <p className="hub-daily-countdown">{countdownDisplay}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
