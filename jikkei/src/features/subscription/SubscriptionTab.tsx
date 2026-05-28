import './Subscription.css'
import { PLANS } from './plans'
import { useSubscription } from './useSubscription'
import type { Tier } from './types'
import { useCredits } from '@/features/credits/useCredits'
import CreditsDisplay from '@/features/credits/CreditsDisplay'

function buttonLabel(planId: Tier, currentTier: Tier, upgradeState: string): string {
  if (planId === currentTier) return 'CURRENT PLAN'
  if (upgradeState === 'pending') return 'PROCESSING…'
  if (upgradeState === 'success') return '✓ UPGRADED'
  return `UPGRADE TO ${planId.toUpperCase()}`
}

export function SubscriptionTab() {
  const { currentTier, upgradeState, upgrade, manage } = useSubscription()
  const { credits } = useCredits()

  return (
    <section className="sub-wrap">
      <div className="sub-header">
        <p className="settings-kicker">BILLING</p>
        <h3 className="sub-heading">Choose your plan</h3>
        <p className="sub-subheading">
          You're currently on the{' '}
          <strong className="sub-current-tier-name">{currentTier}</strong> plan.
        </p>
      </div>

      {credits && (
        <div className="sub-credits-row">
          <span className="sub-credits-label">CREDITS</span>
          <CreditsDisplay credits={credits} className="sub-credits-value" />
        </div>
      )}

      <div className="sub-plan-grid">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentTier
          const isPremiumPlan = plan.id === 'premium'
          const disabled = isCurrent || upgradeState === 'pending'

          return (
            <article
              key={plan.id}
              className={[
                'sub-plan-card',
                isPremiumPlan ? 'sub-plan-card--premium' : '',
                isCurrent ? 'sub-plan-card--current' : '',
              ].filter(Boolean).join(' ')}
            >
              {isPremiumPlan && (
                <span className="sub-plan-ribbon">BEST VALUE</span>
              )}

              <p className="sub-plan-name">{plan.name}</p>

              <div className="sub-plan-price-row">
                <span className="sub-plan-price">{plan.priceLabel}</span>
                <span className="sub-plan-price-suffix">{plan.priceSuffix}</span>
              </div>

              <p className="sub-plan-tagline">{plan.tagline}</p>

              <ul className="sub-plan-features">
                {plan.features.map((feature) => (
                  <li key={feature} className="sub-plan-feature">
                    <span className="sub-plan-feature-check" aria-hidden="true">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className={[
                  'sub-plan-btn',
                  isCurrent
                    ? 'sub-plan-btn--current'
                    : isPremiumPlan
                    ? 'sub-plan-btn--premium'
                    : 'sub-plan-btn--ghost',
                ].join(' ')}
                disabled={disabled}
                onClick={() => { if (!isCurrent) void upgrade(plan.id) }}
              >
                {buttonLabel(plan.id, currentTier, upgradeState)}
              </button>
            </article>
          )
        })}
      </div>

      {currentTier === 'premium' && (
        <button type="button" className="sub-manage-link" onClick={manage}>
          Manage billing / cancel subscription
        </button>
      )}
    </section>
  )
}
