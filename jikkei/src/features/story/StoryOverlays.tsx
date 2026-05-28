import { AnimatePresence, motion } from 'framer-motion'
import ChoicePanel from '@/components/game/ChoicePanel'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CreditsExhaustedModal from '@/features/credits/CreditsExhaustedModal'
import { StorySettingsModal } from './StorySettingsModal'
import type { StoryController } from './useStoryController'

interface StoryOverlaysProps {
  controller: StoryController
}

export function StoryOverlays({ controller }: StoryOverlaysProps) {
  const {
    ending, session, pendingChoices, showChoices, setShowChoices,
    showSettingsModal, setShowSettingsModal, navigate,
    showRestartConfirm, setShowRestartConfirm, isRestarting, handleRestart,
    showCreditsExhausted, setShowCreditsExhausted, credits,
    handleTurnSubmit, handleRedo, canRedo, isRedoing,
  } = controller

  return (
    <>
      <AnimatePresence>
        {showChoices && (
          <ChoicePanel
            choices={pendingChoices.map((text, index) => ({ id: String(index), text }))}
            onSubmit={handleTurnSubmit}
            onClose={() => setShowChoices(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ending && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-ending-title"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,2,12,0.88)', backdropFilter: 'blur(10px)' }}
          >
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ textAlign: 'center', maxWidth: 520, padding: '0 32px' }}>
              <p style={{ fontFamily: 'var(--font-display,sans-serif)', fontSize: 11, letterSpacing: '0.25em', color: 'rgba(255,133,179,0.7)', textTransform: 'uppercase' }}>{ending.outcome ?? 'Story End'}</p>
              <h2 id="story-ending-title" style={{ fontFamily: 'var(--font-display,sans-serif)', fontSize: 32, color: '#fff', lineHeight: 1.3 }}>{ending.message ?? 'The story has ended.'}</h2>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
                {session?.gameMode === 'normal' && canRedo && (
                  <button type="button" disabled={isRedoing} onClick={() => { void handleRedo() }} style={{ padding: '12px 28px', borderRadius: 999, border: '1px solid rgba(255,133,179,0.65)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: isRedoing ? 'wait' : 'pointer' }}>{isRedoing ? 'Regenerating…' : '↩ Redo Final Turn'}</button>
                )}
                <button type="button" onClick={() => setShowRestartConfirm(true)} style={{ padding: '12px 28px', borderRadius: 999, border: '2px solid rgba(255,133,179,0.95)', background: 'linear-gradient(180deg,rgba(255,155,195,0.9),rgba(233,30,140,0.85))', color: '#fff', cursor: 'pointer' }}>↻ Play Again</button>
                <button type="button" onClick={() => navigate('/play')} style={{ padding: '12px 28px', borderRadius: 999, border: '1px solid rgba(255,133,179,0.4)', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,185,215,0.9)', cursor: 'pointer' }}>← Browse Scenes</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showSettingsModal && (
        <StorySettingsModal onClose={() => setShowSettingsModal(false)} onExit={() => navigate('/play')} />
      )}

      <ConfirmModal
        isOpen={showRestartConfirm}
        title="Restart Story"
        message="This deletes your current progress, history, and lore for this story and starts completely over from the beginning. This action cannot be undone."
        confirmText="RESTART"
        cancelText="CANCEL"
        isConfirming={isRestarting}
        onConfirm={handleRestart}
        onCancel={() => setShowRestartConfirm(false)}
      />

      <CreditsExhaustedModal
        isOpen={showCreditsExhausted}
        resetsAt={credits?.resets_at ?? null}
        onClose={() => setShowCreditsExhausted(false)}
      />
    </>
  )
}
