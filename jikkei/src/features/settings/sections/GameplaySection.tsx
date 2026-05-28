import { Toggle } from '../Toggle'
import { LANGUAGES, type LangCode } from '../types'

interface GameplaySectionProps {
  autoPlay: boolean
  language: LangCode
  setAutoPlay: (fn: (prev: boolean) => boolean) => void
  setLanguage: (code: LangCode) => void
}

export function GameplaySection({ autoPlay, language, setAutoPlay, setLanguage }: GameplaySectionProps) {
  return (
    <article className="settings-card">
      <p className="settings-kicker">GAMEPLAY</p>
      <h3 className="settings-heading">Preferences</h3>

      <div className="st-compact-grid">
        <div className="st-compact-cell">
          <span className="st-label">AUTO ADVANCE</span>
          <Toggle checked={autoPlay} onChange={() => setAutoPlay((v) => !v)} />
        </div>

        <div className="st-compact-cell st-compact-cell--full" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <span className="st-label">LANGUAGE</span>
          <div className="st-lang-grid">
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code} type="button"
                className={`st-lang-btn ${language === code ? 'st-lang-btn--active' : ''}`}
                onClick={() => setLanguage(code)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}
