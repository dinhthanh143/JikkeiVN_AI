import { AnimatePresence, motion } from 'framer-motion'
import DialogueBox from '@/components/game/DialogueBox'
import CreditsDisplay from '@/features/credits/CreditsDisplay'
import { StoryControlPanel } from './StoryControlPanel'
import type { StoryController } from './useStoryController'

interface StoryHudProps {
  controller: StoryController
  storyId: string
}

export function StoryHud({ controller, storyId }: StoryHudProps) {
  const {
    session, sessionChars, currentSpeakers, pendingChoices, showChoices,
    setShowChoices, isAiLoading, canRedo, isRedoing, hasAIError,
    lastFailedInput, lastFailedInputType, isLockedByOtherTab,
    credits, setShowSettingsModal, handleRetry, handleRedo,
    handleDialogueDone, handleActiveSpeakerChange, applyPendingCharChange,
    notification,
  } = controller

  const isBusy = isAiLoading || isLockedByOtherTab

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none' }}>
      <button
        type="button"
        onClick={() => setShowSettingsModal(true)}
        style={{ position: 'absolute', top: 24, left: 24, background: 'linear-gradient(180deg,rgba(255,223,236,.98),rgba(255,194,218,.98))', border: '2px solid rgba(255,133,179,.95)', color: '#6b2254', borderRadius: 999, padding: '10px 24px', cursor: 'pointer', fontFamily: 'var(--font-display,sans-serif)', fontSize: 15, letterSpacing: '0.08em', pointerEvents: 'auto', boxShadow: '0 8px 20px rgba(233,30,140,.26)' }}
      >
        SETTINGS
      </button>

      {credits && (
        <div style={{ position: 'absolute', top: 24, left: 184, background: 'rgba(255,236,246,0.85)', border: '1.5px solid rgba(255,133,179,0.5)', borderRadius: 999, padding: '8px 16px', backdropFilter: 'blur(4px)' }}>
          <CreditsDisplay credits={credits} className="story-credits-badge" />
        </div>
      )}

      {!showChoices && pendingChoices.length > 0 && (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => { if (!isBusy) setShowChoices(true) }}
          style={{ position: 'absolute', bottom: 200, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 7px', borderRadius: '12px 0 0 12px', fontFamily: 'var(--font-mono,monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', writingMode: 'vertical-rl', background: 'linear-gradient(180deg,rgba(255,204,226,.97),rgba(255,155,195,.97))', border: '2px solid rgba(255,133,179,.95)', borderRight: 'none', color: '#5a1a4a', cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.45 : 1, pointerEvents: 'auto', zIndex: 55, boxShadow: '-4px 0 16px rgba(233,30,140,.18)' }}
        >
          <span aria-hidden="true">◀</span>
          <span>CHOICE</span>
        </button>
      )}

      <StoryControlPanel controller={controller} storyId={storyId} />

      <DialogueBox
        key={currentSpeakers.map((message) => message.id).join(':') || 'empty-dialogue'}
        speakers={currentSpeakers}
        sessionChars={sessionChars}
        isLoading={isAiLoading}
        onAllDone={handleDialogueDone}
        onActiveSpeakerChange={handleActiveSpeakerChange}
        onSpeakerFinished={applyPendingCharChange}
      />

      <div style={{ position: 'absolute', bottom: 32, right: 'max(8px, calc((100% - min(1050px, 90vw)) / 2 - 52px))', height: 144, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none', zIndex: 75 }}>
        <AnimatePresence>
          {hasAIError && lastFailedInput && lastFailedInputType !== 'redo' && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              onClick={handleRetry} title="Retry failed turn" aria-label="Retry failed turn"
              style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(240,80,80,0.8)', background: 'linear-gradient(180deg,rgba(255,180,180,.97),rgba(230,60,60,.92))', color: '#fff', fontSize: 16, cursor: 'pointer', pointerEvents: 'auto' }}
            >
              ↻
            </motion.button>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {session?.gameMode === 'normal' && canRedo && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: isBusy ? 0.45 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              onClick={() => { void handleRedo() }} disabled={isBusy} title="Regenerate previous turn" aria-label="Regenerate previous turn"
              style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,133,179,.95)', background: 'linear-gradient(180deg,rgba(255,204,226,.97),rgba(255,155,195,.97))', color: '#5a1a4a', fontSize: 16, cursor: isBusy ? 'not-allowed' : 'pointer', pointerEvents: 'auto' }}
            >
              {isRedoing ? '…' : '↩'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {isLockedByOtherTab && (
        <div role="status" style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'rgba(10,10,20,.85)', border: '1px solid rgba(255,133,179,.5)', borderRadius: 10, padding: '8px 18px', color: 'rgba(255,185,215,.9)', fontSize: 12 }}>
          Another tab is submitting a turn…
        </div>
      )}

      <AnimatePresence>
        {notification && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{ position: 'fixed', left: 0, right: 0, bottom: 28, zIndex: 1701, width: 'fit-content', margin: '0 auto', padding: '10px 16px', borderRadius: 999, background: 'rgba(90, 26, 74, 0.96)', color: '#fff', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', boxShadow: '0 12px 28px rgba(10, 10, 15, 0.25)', pointerEvents: 'none' }}
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
