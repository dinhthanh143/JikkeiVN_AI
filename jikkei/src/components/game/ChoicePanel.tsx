import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

interface Choice {
  id: string
  text: string
}

interface ChoicePanelProps {
  choices?: Choice[]
  onSubmit: (text: string, inputType: 'option' | 'prompt') => Promise<{ ok: boolean; message?: string }>
  onClose?: () => void
}

export default function ChoicePanel({ choices = [], onSubmit, onClose }: ChoicePanelProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const customInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showCustomInput) setTimeout(() => customInputRef.current?.focus(), 50)
  }, [showCustomInput])

  const handleClose = () => {
    if (isSubmitting) return
    setShowCustomInput(false)
    setCustomInput('')
    setError(null)
    onClose?.()
  }

  const submit = async (text: string, inputType: 'option' | 'prompt') => {
    if (!text.trim() || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await onSubmit(text.trim(), inputType)
      if (result.ok) {
        setCustomInput('')
        onClose?.()
        return
      }
      setError(result.message ?? 'Something went wrong. Please try again.')
      setIsSubmitting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsSubmitting(false)
    }
  }

  const handleChoiceSelect = (choice: Choice) => { void submit(choice.text, 'option') }
  const handleCustomSubmit = () => { void submit(customInput, 'prompt') }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Story choices"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 70,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,10,15,0.55)', backdropFilter: 'blur(6px)', pointerEvents: 'auto',
      }}
    >
      {/* Close */}
      <button
        onClick={handleClose}
        disabled={isSubmitting}
        style={{
          position: 'absolute', top: 24, right: 24,
          background: 'rgba(255,155,195,0.3)', border: '1px solid rgba(255,133,179,0.6)',
          color: '#fff', borderRadius: 999, padding: '6px 16px',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-mono,monospace)', fontSize: 12, letterSpacing: '0.08em', fontWeight: 700,
          opacity: isSubmitting ? 0.5 : 1, transition: 'background 150ms ease',
        }}
        onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = 'rgba(255,133,179,0.45)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,155,195,0.3)' }}
      >
        ✕ CLOSE
      </button>

      {/* Submitting overlay */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
          >
            <p style={{ fontFamily: 'var(--font-display,sans-serif)', fontSize: 18, letterSpacing: '0.12em', color: 'rgba(255,185,215,0.9)', animation: 'choicePulse 1.2s ease-in-out infinite' }}>
              ...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', background: 'rgba(220,30,60,0.85)', color: '#fff', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-ui,sans-serif)', letterSpacing: '0.03em' }}>
          {error}
        </div>
      )}

      <div style={{
        width: '100%', maxWidth: 680, padding: '0 32px',
        display: 'flex', flexDirection: 'column', gap: 12,
        opacity: isSubmitting ? 0.35 : 1, transition: 'opacity 200ms ease',
        pointerEvents: isSubmitting ? 'none' : 'auto',
      }}>
        {choices.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'rgba(255,185,215,0.7)', fontFamily: 'var(--font-display,sans-serif)', letterSpacing: '0.1em', fontSize: 18 }}>
            NO CHOICES
          </p>
        ) : (
          choices.map((choice, index) => (
            <motion.button
              key={choice.id}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.08, type: 'spring', stiffness: 300, damping: 22 }}
              onClick={() => handleChoiceSelect(choice)}
              style={{
                display: 'flex', alignItems: 'center', padding: '18px 24px',
                background: 'rgba(20,10,30,0.88)', border: '2px solid rgba(255,133,179,0.5)',
                borderLeft: '4px solid rgba(255,133,179,0.9)', borderRadius: 4,
                cursor: 'pointer', textAlign: 'left', transition: 'all 200ms ease',
                color: '#fff', fontFamily: 'var(--font-ui,sans-serif)', fontSize: 18,
                fontWeight: 700, letterSpacing: '0.02em', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(233,30,140,0.35)'
                e.currentTarget.style.borderColor = 'rgba(255,133,179,0.95)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(20,10,30,0.88)'
                e.currentTarget.style.borderColor = 'rgba(255,133,179,0.5)'
              }}
            >
              <ChevronRight style={{ width: 22, height: 22, marginRight: 14, color: 'rgba(255,133,179,0.8)', flexShrink: 0 }} />
              {choice.text}
              <span style={{ position: 'absolute', right: 20, fontSize: 42, fontWeight: 900, color: 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-display,sans-serif)' }}>
                0{index + 1}
              </span>
            </motion.button>
          ))
        )}

        {/* Write your own */}
        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: choices.length * 0.08, type: 'spring', stiffness: 300, damping: 22 }}
        >
          <AnimatePresence mode="wait">
            {!showCustomInput ? (
              <motion.button
                key="write-btn"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowCustomInput(true)}
                style={{
                  display: 'flex', alignItems: 'center', width: '100%',
                  padding: '16px 24px', background: 'rgba(255,133,179,0.08)',
                  border: '2px dashed rgba(255,133,179,0.45)', borderRadius: 4,
                  cursor: 'pointer', textAlign: 'left', color: 'rgba(255,185,215,0.85)',
                  fontFamily: 'var(--font-ui,sans-serif)', fontSize: 16, fontWeight: 600,
                  letterSpacing: '0.02em', transition: 'all 200ms ease', gap: 12,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,133,179,0.15)'
                  e.currentTarget.style.borderColor = 'rgba(255,133,179,0.7)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,133,179,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(255,133,179,0.45)'
                }}
              >
                <span style={{ fontSize: 20 }}>✍️</span>
                Write your own choice...
              </motion.button>
            ) : (
              <motion.div
                key="write-input"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                style={{ display: 'flex', gap: 10 }}
              >
                <input
                  ref={customInputRef}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomSubmit()
                    if (e.key === 'Escape') { setShowCustomInput(false); setCustomInput('') }
                  }}
                  placeholder="Type your action..."
                  style={{
                    flex: 1, padding: '14px 18px', borderRadius: 6,
                    border: '2px solid rgba(255,133,179,0.7)',
                    background: 'rgba(20,10,30,0.92)', color: '#fff',
                    fontFamily: 'var(--font-ui,sans-serif)', fontSize: 16,
                    outline: 'none', caretColor: '#ff85b3',
                  }}
                />
                <button
                  onClick={handleCustomSubmit}
                  style={{
                    padding: '14px 22px', borderRadius: 6,
                    border: '2px solid rgba(255,133,179,0.9)',
                    background: 'linear-gradient(180deg,rgba(255,155,195,0.9),rgba(233,30,140,0.85))',
                    color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                    fontFamily: 'var(--font-ui,sans-serif)',
                  }}
                >
                  GO
                </button>
                <button
                  onClick={() => { setShowCustomInput(false); setCustomInput('') }}
                  style={{
                    padding: '14px 16px', borderRadius: 6,
                    border: '1px solid rgba(255,133,179,0.4)',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,185,215,0.8)', fontSize: 14, cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <style>{`@keyframes choicePulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
    </motion.div>
  )
}
