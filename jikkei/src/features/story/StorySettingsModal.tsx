import { useEffect, useRef } from 'react'
import { GameTab } from '@/features/settings/tabs/GameTab'
import { useSettingsState } from '@/features/settings/useSettingsState'
import '@/styles/SettingsPanel.css'

interface StorySettingsModalProps {
  onClose: () => void
  onExit: () => void
}

export function StorySettingsModal({ onClose, onExit }: StorySettingsModalProps) {
  const settings = useSettingsState()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-settings-title"
      style={{ position: 'absolute', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,15,.65)', backdropFilter: 'blur(7px)', animation: 'fadeIn .2s ease-out' }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div style={{ width: 'min(680px, 92vw)', borderRadius: 22, border: '2px solid rgba(255,133,179,.88)', background: 'linear-gradient(160deg,rgba(255,236,246,.99),rgba(255,210,230,.99))', boxShadow: '0 24px 60px rgba(10,10,15,.38)', padding: '24px 24px 20px', animation: 'modalPop .26s cubic-bezier(.22,1,.36,1)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexShrink: 0 }}>
          <div>
            <h2 id="story-settings-title" style={{ margin: 0, fontFamily: 'var(--font-display,sans-serif)', letterSpacing: '0.07em', color: '#5a1a4a', fontSize: 22 }}>SETTINGS</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close settings" style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(255,133,179,0.6)', background: 'rgba(255,255,255,0.55)', color: '#7a2a62', fontSize: 16, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ minHeight: 0, overflowY: 'auto', paddingRight: 6, scrollbarGutter: 'stable' }}>
          <GameTab
            bgmVolume={settings.bgmVolume} setBgmVolume={settings.setBgmVolume}
            bgmEnabled={settings.bgmEnabled} setBgmEnabled={settings.setBgmEnabled}
            sfxVolume={settings.sfxVolume} setSfxVolume={settings.setSfxVolume}
            sfxEnabled={settings.sfxEnabled} setSfxEnabled={settings.setSfxEnabled}
            textSfxEnabled={settings.textSfxEnabled} setTextSfxEnabled={settings.setTextSfxEnabled}
            textSfxVolume={settings.textSfxVolume} setTextSfxVolume={settings.setTextSfxVolume}
            textSfxType={settings.textSfxType} handleTextTypeChange={settings.handleTextTypeChange}
            autoPlay={settings.autoPlay} setAutoPlay={settings.setAutoPlay}
            language={settings.language} setLanguage={settings.setLanguage}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, flexShrink: 0 }}>
          <button type="button" onClick={onExit} style={{ borderRadius: 999, border: '1px solid rgba(255,133,179,0.5)', background: 'rgba(255,255,255,0.55)', color: '#5a1a4a', fontFamily: 'var(--font-ui,sans-serif)', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.04em', padding: '8px 18px', cursor: 'pointer' }}>← Exit Story</button>
          <button
            type="button"
            onClick={() => { void settings.handleSaveGame() }}
            disabled={settings.saveState === 'saving'}
            style={{ borderRadius: 999, border: '2px solid rgba(255,133,179,0.95)', background: 'linear-gradient(180deg, rgba(255,204,226,1), rgba(255,155,195,1))', color: '#5a1a4a', fontFamily: 'var(--font-display,sans-serif)', fontWeight: 700, fontSize: '0.86rem', letterSpacing: '0.08em', padding: '9px 26px', minWidth: 140, cursor: settings.saveState === 'saving' ? 'not-allowed' : 'pointer', opacity: settings.saveState === 'saving' ? 0.65 : 1 }}
          >
            {settings.saveState === 'idle' ? 'SAVE CHANGES' : settings.saveState === 'saving' ? 'SAVING…' : settings.saveState === 'success' ? '✓ SAVED' : 'FAILED — RETRY'}
          </button>
        </div>
      </div>
    </div>
  )
}
