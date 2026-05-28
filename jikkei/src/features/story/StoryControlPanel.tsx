import { AnimatePresence, motion } from 'framer-motion'
import { getStoryExpressionOptions } from './storyPresentation'
import type { StoryController } from './useStoryController'

const PANEL_WIDTH = 220

const panelButtonStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1px solid rgba(255,133,179,0.55)', background: 'rgba(255,255,255,0.45)',
  color: '#5a1a4a', fontFamily: 'var(--font-ui, sans-serif)', fontWeight: 700,
  fontSize: 13, cursor: 'pointer', textAlign: 'left', transition: 'background 150ms ease',
  letterSpacing: '0.03em',
}

interface StoryControlPanelProps {
  controller: StoryController
  storyId: string
}

export function StoryControlPanel({ controller, storyId }: StoryControlPanelProps) {
  const {
    scene, session, sessionChars, backgrounds, currentBgUrl, visibleExpressions,
    isPanelOpen, panelView, setPanelView, handlePanelToggle,
    isRestarting, setShowRestartConfirm, navigate,
    isChangingBackground, handleManualBackgroundChange, handleExpressionPreview,
  } = controller

  if (!scene) return null

  const renderContent = () => {
    if (panelView === 'menu') {
      const actions = [
        { label: '🎮 Game Controls', action: () => setPanelView('game-controls') },
        { label: '✏️ Edit', action: () => navigate(`/story/${storyId}/edit`) },
        { label: '📜 Summary', action: () => setPanelView('summary') },
      ]
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 12px' }}>
          {actions.map(({ label, action }) => (
            <button key={label} type="button" style={panelButtonStyle} onClick={action}>{label}</button>
          ))}
        </div>
      )
    }

    if (panelView === 'summary') {
      return (
        <div style={{ padding: 12 }}>
          <button type="button" onClick={() => setPanelView('menu')} style={{ ...panelButtonStyle, marginBottom: 12, background: 'rgba(255,155,195,0.35)', fontSize: 12 }}>← Back</button>
          {session?.historySummary ? (
            <p style={{ color: 'rgba(90,26,74,0.75)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>{session.historySummary}</p>
          ) : (
            <p style={{ color: 'rgba(90,26,74,0.5)', fontSize: 13, textAlign: 'center', marginTop: 24, fontStyle: 'italic' }}>Nothing here yet...</p>
          )}
        </div>
      )
    }

    return (
      <div style={{ padding: 12 }}>
        <button type="button" onClick={() => setPanelView('menu')} style={{ ...panelButtonStyle, marginBottom: 12, background: 'rgba(255,155,195,0.35)', fontSize: 12 }}>← Back</button>

        <h3 style={{ margin: '0 0 10px', color: '#5a1a4a', fontFamily: 'var(--font-display,sans-serif)', fontSize: 13, letterSpacing: '0.06em' }}>BACKGROUNDS</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {backgrounds.map((background) => {
            const selected = currentBgUrl === background.image_url
            return (
              <button
                key={background.id}
                type="button"
                disabled={isChangingBackground}
                onClick={() => { void handleManualBackgroundChange(background) }}
                style={{ ...panelButtonStyle, background: selected ? 'linear-gradient(180deg,rgba(255,185,215,.75),rgba(255,155,195,.75))' : 'rgba(255,255,255,0.35)', fontWeight: selected ? 700 : 500, opacity: isChangingBackground ? 0.6 : 1 }}
              >
                {selected ? '● ' : '○ '}{background.name}
              </button>
            )
          })}
        </div>

        {sessionChars.some((character) => getStoryExpressionOptions(character, scene).length > 0) && (
          <>
            <h3 style={{ margin: '0 0 10px', color: '#5a1a4a', fontFamily: 'var(--font-display,sans-serif)', fontSize: 13, letterSpacing: '0.06em' }}>EXPRESSION PREVIEW</h3>
            <p style={{ margin: '-4px 0 10px', fontSize: 10, color: 'rgba(90,26,74,0.55)', lineHeight: 1.4 }}>Visual preview only. The next story cue takes control again.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {sessionChars.map((character) => {
                const expressions = getStoryExpressionOptions(character, scene)
                if (expressions.length === 0) return null
                return (
                  <div key={character.id}>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: 'rgba(90,26,74,0.55)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{character.name}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {expressions.map((expression) => {
                        const selected = visibleExpressions[character.id] === expression.slot_key
                        return (
                          <button
                            key={expression.slot_key}
                            type="button"
                            onClick={() => handleExpressionPreview(character.id, expression.slot_key)}
                            title={expression.display_name}
                            style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${selected ? 'rgba(233,30,140,0.7)' : 'rgba(255,133,179,0.4)'}`, background: selected ? 'linear-gradient(180deg,rgba(255,185,215,.85),rgba(255,133,179,.75))' : 'rgba(255,255,255,0.3)', color: '#5a1a4a', fontSize: 11, fontWeight: selected ? 700 : 500, cursor: 'pointer' }}
                          >
                            {expression.display_name || expression.slot_key}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <h3 style={{ margin: '0 0 10px', color: '#5a1a4a', fontFamily: 'var(--font-display,sans-serif)', fontSize: 13, letterSpacing: '0.06em' }}>CHARACTERS</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessionChars.map((character) => (
            <div key={character.id} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,133,179,0.3)', opacity: character.is_active ? 1 : 0.45 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#5a1a4a', fontWeight: 700 }}>{character.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(90,26,74,0.6)' }}>{character.status} · pos {character.position ?? '—'}</p>
              {Object.entries(character.attribute_values).map(([key, value]) => {
                const definition = scene.characters
                  .find((candidate) => candidate.id === character.source_character_id)
                  ?.attributes.find((attribute) => attribute.attr_key === key)
                if (definition && !definition.is_visible_to_player) return null
                const maximum = definition?.max_value ?? 100
                const percentage = maximum > 0 ? Math.max(0, Math.min(100, Math.round((value / maximum) * 100))) : 0
                return (
                  <div key={key} style={{ marginTop: 6 }}>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(90,26,74,0.55)', textTransform: 'capitalize' }}>{definition?.display_name ?? key}: {value}</p>
                    <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,133,179,0.2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percentage}%`, background: 'rgba(233,30,140,0.6)', borderRadius: 99, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,133,179,0.25)' }}>
          <button
            type="button"
            onClick={() => setShowRestartConfirm(true)}
            disabled={isRestarting}
            style={{ ...panelButtonStyle, background: 'rgba(220,60,60,0.12)', borderColor: 'rgba(220,60,60,0.45)', color: '#8b1a1a', opacity: isRestarting ? 0.6 : 1 }}
          >
            {isRestarting ? 'Restarting...' : '↻ Restart'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <motion.div animate={{ x: isPanelOpen ? 0 : PANEL_WIDTH }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} style={{ position: 'absolute', top: 16, right: 0, display: 'flex', alignItems: 'flex-start', pointerEvents: 'auto', zIndex: 60 }}>
      <button type="button" onClick={handlePanelToggle} aria-expanded={isPanelOpen} aria-label="Toggle story controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 7px', background: 'linear-gradient(180deg,rgba(255,204,226,.97),rgba(255,155,195,.97))', border: '2px solid rgba(255,133,179,.95)', borderRight: 'none', borderRadius: '12px 0 0 12px', cursor: 'pointer', color: '#5a1a4a', fontFamily: 'var(--font-mono,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', writingMode: 'vertical-rl', boxShadow: '-4px 0 16px rgba(233,30,140,.18)' }}>
        <span aria-hidden="true">{isPanelOpen ? '▶' : '◀'}</span>
        <span>CONTROL</span>
      </button>
      <div style={{ width: PANEL_WIDTH, background: 'linear-gradient(160deg,rgba(255,236,246,.97),rgba(255,210,230,.97))', border: '2px solid rgba(255,133,179,.5)', borderRight: 'none', borderTop: 'none', borderRadius: '0 0 0 14px', boxShadow: '-6px 6px 28px rgba(233,30,140,.14)', overflowY: 'auto', maxHeight: 'calc(100vh - 32px)' }}>
        <AnimatePresence mode="wait">
          <motion.div key={panelView} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}>
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
