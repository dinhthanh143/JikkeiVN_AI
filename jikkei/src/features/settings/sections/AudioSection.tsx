import { Toggle } from '../Toggle'
import type React from 'react'

interface AudioSectionProps {
  bgmVolume: number
  bgmEnabled: boolean
  sfxVolume: number
  sfxEnabled: boolean
  setBgmVolume: (v: number) => void
  setBgmEnabled: (fn: (prev: boolean) => boolean) => void
  setSfxVolume: (v: number) => void
  setSfxEnabled: (fn: (prev: boolean) => boolean) => void
}

function VolumeRow({
  label, enabled, volume,
  onToggle, onVolume,
}: {
  label: string
  enabled: boolean
  volume: number
  onToggle: () => void
  onVolume: (v: number) => void
}) {
  return (
    <div className="st-audio-row">
      <div className="st-audio-row-head">
        <span className="st-label">{label}</span>
        <div className="st-audio-row-controls">
          <span className="st-audio-pct" style={{ opacity: enabled ? 1 : 0.4 }}>{volume}%</span>
          <Toggle checked={enabled} onChange={onToggle} />
        </div>
      </div>
      <input
        type="range" min={0} max={100} value={volume}
        disabled={!enabled}
        className="st-slider"
        style={{ '--pct': `${volume}%` } as React.CSSProperties}
        onChange={(e) => onVolume(Number(e.target.value))}
      />
    </div>
  )
}

export function AudioSection({
  bgmVolume, bgmEnabled, sfxVolume, sfxEnabled,
  setBgmVolume, setBgmEnabled, setSfxVolume, setSfxEnabled,
}: AudioSectionProps) {
  return (
    <article className="settings-card">
      <p className="settings-kicker">AUDIO</p>
      <h3 className="settings-heading">Mixer</h3>
      <div className="st-audio-stack">
        <VolumeRow
          label="MUSIC" enabled={bgmEnabled} volume={bgmVolume}
          onToggle={() => setBgmEnabled((v) => !v)}
          onVolume={setBgmVolume}
        />
        <VolumeRow
          label="SFX" enabled={sfxEnabled} volume={sfxVolume}
          onToggle={() => setSfxEnabled((v) => !v)}
          onVolume={setSfxVolume}
        />
      </div>
    </article>
  )
}
