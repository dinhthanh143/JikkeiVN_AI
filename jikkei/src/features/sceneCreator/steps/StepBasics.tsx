import { TIER_LIMITS } from '../types'
import type { WizardData, ErrorMap } from '../types'

interface Props {
  data: WizardData
  isEditMode: boolean
  isPremium: boolean
  stepErrors: ErrorMap
  setSceneField: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void
}

export function StepBasics({ data, isEditMode, isPremium, stepErrors, setSceneField }: Props) {
  return (
    <div className="sc-step-body">
      <div className="sc-card">
        <div className="sc-section-label"><span className="sc-dot" /><span className="sc-section-title">Story basics</span></div>
        <label className="sc-field">
          <span className="sc-field-label">Story title</span>
          <input
            className="sc-input"
            type="text"
            maxLength={80}
            placeholder="Give your Story a name"
            value={data.title}
            onChange={(e) => setSceneField('title', e.target.value)}
          />
          {stepErrors.title ? <p className="sc-error">{stepErrors.title}</p> : null}
        </label>
        <label className="sc-field">
          <span className="sc-field-label">Description</span>
          <textarea
            className="sc-textarea"
            rows={4}
            maxLength={1000}
            placeholder="Describe where and when this story takes place..."
            value={data.description}
            onChange={(e) => setSceneField('description', e.target.value)}
          />
          <span className="sc-counter">{data.description.length} / 1000</span>
          {stepErrors.description ? <p className="sc-error">{stepErrors.description}</p> : null}
        </label>

        <div className="sc-field" style={{ marginTop: 6, marginBottom: 10 }}>
          <span className="sc-field-label">Game mode</span>
          <div className="sc-mode-grid">
            <button
              type="button"
              className={`sc-mode-card sc-mode-card-green ${data.gameMode === 'normal' ? 'sc-mode-card-active' : ''}`}
              onClick={() => setSceneField('gameMode', 'normal')}
            >
              <div className="sc-mode-card-head">
                <span className="sc-mode-icon sc-mode-icon-green">◈</span>
                <span className="sc-mode-tag sc-mode-tag-green-solid">RECOMMENDED</span>
              </div>
              <h3>Normal</h3>
              <p>No fail condition. Attributes shape tone, not outcomes.</p>
            </button>
            <button
              type="button"
              className={`sc-mode-card sc-mode-card-red ${data.gameMode === 'survival' ? 'sc-mode-card-active' : ''}`}
              onClick={() => setSceneField('gameMode', 'survival')}
            >
              <div className="sc-mode-card-head">
                <span className="sc-mode-icon sc-mode-icon-red">⚠</span>
                <span className="sc-mode-tag sc-tag-red">HARDCORE</span>
              </div>
              <h3>Hardcore</h3>
              <p>Bad endings are real. Attributes hitting their limits can end the story.</p>
            </button>
          </div>
        </div>

        <div className="sc-toggle-row" style={{ marginTop: 10 }}>
          <div className="sc-toggle-copy">
            <strong>NSFW</strong>
            <span>Allows explicit themes when narratively appropriate.</span>
          </div>
          <button
            type="button"
            className={`sc-switch ${data.isNsfw ? 'sc-switch-on' : ''}`}
            onClick={() => setSceneField('isNsfw', !data.isNsfw)}
            aria-label="Toggle NSFW"
          >
            <span className="sc-switch-knob" />
          </button>
        </div>

        <div className="sc-field" style={{ marginTop: 14 }}>
          <span className="sc-field-label">Story tier</span>
          {isEditMode ? (
            <div className="sc-tier-locked">
              <span className="sc-tier-locked-badge">{data.tier === 'premium' ? '✦ PREMIUM' : '◈ FREE'}</span>
              <span className="sc-tier-locked-note">Tier is locked after creation.</span>
            </div>
          ) : (
            <div className="sc-mode-grid">
              <button
                type="button"
                className={`sc-mode-card ${data.tier === 'free' ? 'sc-mode-card-active' : ''}`}
                onClick={() => setSceneField('tier', 'free')}
              >
                <div className="sc-mode-card-head"><span className="sc-mode-icon">◈</span><span className="sc-mode-tag">FREE</span></div>
                <h3>Free</h3>
                <p>Up to {TIER_LIMITS.free.characters} characters, {TIER_LIMITS.free.backgrounds} backgrounds.</p>
              </button>
              <button
                type="button"
                className={`sc-mode-card ${data.tier === 'premium' ? 'sc-mode-card-active' : ''} ${!isPremium ? 'sc-mode-card-locked' : ''}`}
                disabled={!isPremium}
                onClick={() => isPremium && setSceneField('tier', 'premium')}
                title={isPremium ? undefined : 'Requires a premium account'}
              >
                <div className="sc-mode-card-head"><span className="sc-mode-icon">✦</span><span className="sc-mode-tag sc-mode-tag-green-solid">PREMIUM</span></div>
                <h3>Premium {!isPremium ? '🔒' : ''}</h3>
                <p>Up to {TIER_LIMITS.premium.characters} characters, {TIER_LIMITS.premium.backgrounds} backgrounds.</p>
              </button>
            </div>
          )}
        </div>

        <div className="sc-toggle-row" style={{ marginTop: 10 }}>
          <div className="sc-toggle-copy">
            <strong>Public</strong>
            <span>Other players can discover and play this story.</span>
          </div>
          <button
            type="button"
            className={`sc-switch ${data.isPublic ? 'sc-switch-on' : ''}`}
            onClick={() => setSceneField('isPublic', !data.isPublic)}
            aria-label="Toggle public visibility"
          >
            <span className="sc-switch-knob" />
          </button>
        </div>
      </div>
    </div>
  )
}
