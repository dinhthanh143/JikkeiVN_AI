import type React from 'react'
import { Toggle } from '../Toggle'
import { TEXT_TYPES, type TextType } from '../types'

interface DialogueSectionProps {
  textSfxEnabled: boolean
  textSfxVolume: number
  textSfxType: TextType
  setTextSfxEnabled: (fn: (prev: boolean) => boolean) => void
  setTextSfxVolume: (v: number) => void
  onTypeChange: (t: TextType) => void
}

export function DialogueSection({
  textSfxEnabled, textSfxVolume, textSfxType,
  setTextSfxEnabled, setTextSfxVolume, onTypeChange,
}: DialogueSectionProps) {
  return (
    <article className="settings-card">
      <p className="settings-kicker">DIALOGUE</p>
      <h3 className="settings-heading">Text Sound</h3>

      <div className="st-audio-stack">
        {/* Volume row */}
        <div className="st-audio-row">
          <div className="st-audio-row-head">
            <span className="st-label">TEXT SFX</span>
            <div className="st-audio-row-controls">
              <span className="st-audio-pct" style={{ opacity: textSfxEnabled ? 1 : 0.4 }}>
                {textSfxVolume}%
              </span>
              <Toggle checked={textSfxEnabled} onChange={() => setTextSfxEnabled((v) => !v)} />
            </div>
          </div>
          <input
            type="range" min={0} max={100} value={textSfxVolume}
            disabled={!textSfxEnabled}
            className="st-slider"
            style={{ '--pct': `${textSfxVolume}%` } as React.CSSProperties}
            onChange={(e) => setTextSfxVolume(Number(e.target.value))}
          />
        </div>

        {/* Sound type — Dropdown Row */}
        <div className="st-audio-row" style={{ opacity: textSfxEnabled ? 1 : 0.45 }}>
          <div className="st-audio-row-head">
            <span className="st-label">SOUND TYPE</span>
            <div className="st-select-wrapper">
              <select
                value={textSfxType}
                disabled={!textSfxEnabled}
                className="st-type-select"
                onChange={(e) => onTypeChange(Number(e.target.value) as TextType)}
              >
                {TEXT_TYPES.map((t) => (
                  <option key={t} value={t} className="st-type-option">
                    Type {t}
                  </option>
                ))}
              </select>
              <span className="st-type-chevron" aria-hidden>▾</span>
            </div>
          </div>
          {/* Matches the layout footprint of the input range slider */}
          <div className="st-slider-spacer" aria-hidden="true" />
        </div>
      </div>
    </article>
  )
}