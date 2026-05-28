import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { SessionCharacterRecord, TurnMessageRecord } from '@/services/backendApi'
import { usePlayerStore } from '@/store/usePlayerStore'
import { playTextPlip } from '@/audio/sfx'
import { getAutoAdvanceDelay } from './dialogueTiming'

interface DialogueBoxProps {
  speakers: TurnMessageRecord[]
  sessionChars: SessionCharacterRecord[]
  isLoading?: boolean
  onAllDone?: () => void
  onActiveSpeakerChange?: (message: TurnMessageRecord | null) => void
  onSpeakerFinished?: (sessionCharacterId: string) => void
}

const WORD_APPEND_INTERVAL_MS = 140
const WORD_SEGMENT_PATTERN = /^\s*\S+\s+/
const TEXT_LEFT_PADDING_PX = 24
const TEXT_RIGHT_RAIL_PX = 68

const BURST_MIN_MS = 500
const BURST_MAX_MS = 1400
const INTERVAL_MIN_MS = 350
const INTERVAL_MAX_MS = 450

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function useTextBlip(isStreaming: boolean) {
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopLoop = useCallback(() => {
    if (loopRef.current !== null) {
      clearTimeout(loopRef.current)
      loopRef.current = null
    }
  }, [])

  const startLoop = useCallback(() => {
    stopLoop()
    const tick = () => {
      playTextPlip()
      loopRef.current = setTimeout(
        tick,
        randomBetween(BURST_MIN_MS, BURST_MAX_MS) + randomBetween(INTERVAL_MIN_MS, INTERVAL_MAX_MS),
      )
    }
    tick()
  }, [stopLoop])

  useEffect(() => {
    if (isStreaming) startLoop()
    else stopLoop()
    return stopLoop
  }, [isStreaming, startLoop, stopLoop])
}

interface DrainEngineProps {
  sourceText: string
  onDone: () => void
  autoPlay: boolean
}

function useDrainEngine({ sourceText, onDone, autoPlay }: DrainEngineProps) {
  const textRef = useRef<HTMLParagraphElement | null>(null)
  const intervalRef = useRef<number | null>(null)
  const queueRef = useRef<string[]>([])
  const displayedTextRef = useRef('')
  const pageSnapshotRef = useRef('')
  const lastAppendedRef = useRef('')
  const shouldMeasureRef = useRef(false)
  const isPausedRef = useRef(false)
  const skipRequestedRef = useRef(false)
  const onDoneRef = useRef(onDone)

  const [displayedText, setDisplayedText] = useState('')
  const [showPagination, setShowPagination] = useState(false)
  const [animatedSegment, setAnimatedSegment] = useState('')
  const [isDone, setIsDone] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)

  useEffect(() => { onDoneRef.current = onDone }, [onDone])

  const stopDraining = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const appendNext = useCallback(() => {
    if (isPausedRef.current) return
    const next = queueRef.current.shift()
    if (!next) {
      stopDraining()
      skipRequestedRef.current = false
      setIsStreaming(false)
      setIsDone(true)
      return
    }
    pageSnapshotRef.current = displayedTextRef.current
    lastAppendedRef.current = next
    setAnimatedSegment(skipRequestedRef.current ? '' : next)
    displayedTextRef.current = `${pageSnapshotRef.current}${next}`
    setDisplayedText(displayedTextRef.current)
    shouldMeasureRef.current = true
  }, [stopDraining])

  const startDraining = useCallback(() => {
    if (intervalRef.current !== null || isPausedRef.current || queueRef.current.length === 0) return
    setIsStreaming(true)
    intervalRef.current = window.setInterval(appendNext, WORD_APPEND_INTERVAL_MS)
  }, [appendNext])

  useEffect(() => {
    stopDraining()
    queueRef.current = []
    lastAppendedRef.current = ''
    shouldMeasureRef.current = false
    isPausedRef.current = false
    skipRequestedRef.current = false
    displayedTextRef.current = ''
    pageSnapshotRef.current = ''

    if (!sourceText) return
    let remainder = sourceText
    while (remainder.length > 0) {
      const match = remainder.match(WORD_SEGMENT_PATTERN)
      if (!match) {
        queueRef.current.push(remainder)
        break
      }
      queueRef.current.push(match[0])
      remainder = remainder.slice(match[0].length)
    }
    const startTimer = window.setTimeout(startDraining, 0)
    return () => {
      window.clearTimeout(startTimer)
      stopDraining()
    }
  }, [sourceText, startDraining, stopDraining])

  useLayoutEffect(() => {
    if (!shouldMeasureRef.current) return
    shouldMeasureRef.current = false
    const element = textRef.current
    if (!element) return

    if (element.scrollHeight > element.clientHeight) {
      const last = lastAppendedRef.current
      if (last) queueRef.current.unshift(last)
      displayedTextRef.current = pageSnapshotRef.current
      setDisplayedText(pageSnapshotRef.current)
      setShowPagination(true)
      setIsDone(false)
      isPausedRef.current = true
      skipRequestedRef.current = false
      setIsStreaming(false)
      stopDraining()
      return
    }

    pageSnapshotRef.current = displayedTextRef.current
    if (skipRequestedRef.current) {
      window.setTimeout(appendNext, 0)
    }
  }, [appendNext, displayedText, stopDraining])

  const advance = useCallback(() => {
    if (isStreaming) {
      stopDraining()
      skipRequestedRef.current = true
      appendNext()
      return
    }
    if (isDone) {
      onDoneRef.current()
      return
    }
    setShowPagination(false)
    isPausedRef.current = false
    displayedTextRef.current = ''
    pageSnapshotRef.current = ''
    setAnimatedSegment('')
    setDisplayedText('')
    startDraining()
  }, [appendNext, isDone, isStreaming, startDraining, stopDraining])

  const advanceRef = useRef(advance)
  useEffect(() => { advanceRef.current = advance }, [advance])

  useEffect(() => {
    if (!autoPlay || isStreaming || (!showPagination && !isDone)) return
    const timer = window.setTimeout(() => advanceRef.current(), getAutoAdvanceDelay(displayedText))
    return () => window.clearTimeout(timer)
  }, [autoPlay, displayedText, isDone, isStreaming, showPagination])

  return { textRef, displayedText, animatedSegment, showPagination, isDone, isStreaming, advance }
}

interface SpeakerLineProps {
  text: string
  onDone: () => void
  autoPlay: boolean
}

function SpeakerLine({ text, onDone, autoPlay }: SpeakerLineProps) {
  const { textRef, displayedText, animatedSegment, showPagination, isDone, isStreaming, advance } =
    useDrainEngine({ sourceText: text, onDone, autoPlay })
  useTextBlip(isStreaming)
  const canAdvance = showPagination || isDone || isStreaming

  const handleKeyDown = (event: React.KeyboardEvent<HTMLParagraphElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    advance()
  }

  return (
    <>
      {!isStreaming && (showPagination || isDone) && (
        <motion.button
          type="button"
          onClick={(event) => { event.stopPropagation(); advance() }}
          aria-label={isDone ? 'Continue' : 'Next page'}
          animate={{ x: [0, 4, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
          style={{ position: 'absolute', top: 'calc(50% - 24px)', right: 4, zIndex: 30, width: 54, height: 48, border: 'none', background: 'transparent', color: '#5a1a4a', fontFamily: 'var(--font-mono,monospace)', fontSize: 20, fontWeight: 900, cursor: 'pointer' }}
        >
          {'>>'}
        </motion.button>
      )}
      <p
        ref={textRef}
        role="button"
        tabIndex={0}
        aria-label={isStreaming ? 'Complete dialogue text' : 'Advance dialogue'}
        onClick={advance}
        onKeyDown={handleKeyDown}
        style={{ flex: '1 1 auto', fontFamily: 'var(--font-ui,sans-serif)', fontSize: 17, color: '#5a1a4a', margin: 0, lineHeight: 1.55, letterSpacing: '0.25px', textAlign: 'center', whiteSpace: 'pre-wrap', height: '100%', overflow: 'hidden', padding: `0 ${TEXT_RIGHT_RAIL_PX}px 0 ${TEXT_LEFT_PADDING_PX}px`, boxSizing: 'border-box', cursor: canAdvance ? 'pointer' : 'default', outlineOffset: 4 }}
      >
        {animatedSegment && displayedText.endsWith(animatedSegment) ? (
          <>
            <span>{displayedText.slice(0, displayedText.length - animatedSegment.length)}</span>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.38 }} style={{ display: 'inline-block' }}>
              {animatedSegment}
            </motion.span>
          </>
        ) : (
          <span>{displayedText}</span>
        )}
      </p>
    </>
  )
}

function LoadingDots() {
  return (
    <span aria-label="Loading dialogue" role="status" style={{ display: 'inline-flex', gap: '0.28em' }}>
      {[0, 1, 2].map((index) => (
        <motion.span key={index} animate={{ y: [0, -8, 0], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 0.9, delay: index * 0.12 }}>.</motion.span>
      ))}
    </span>
  )
}

export default function DialogueBox({
  speakers,
  sessionChars,
  isLoading = false,
  onAllDone,
  onActiveSpeakerChange,
  onSpeakerFinished,
}: DialogueBoxProps) {
  const [speakerIndex, setSpeakerIndex] = useState(0)
  const [lineIndex, setLineIndex] = useState(0)
  const [frozen, setFrozen] = useState(false)
  const autoPlay = usePlayerStore((state) => state.settings?.auto_play ?? false)

  const safeSpeakerIndex = Math.min(speakerIndex, Math.max(0, speakers.length - 1))
  const currentSpeaker = speakers[safeSpeakerIndex]
  const currentCharacter = currentSpeaker
    ? sessionChars.find((character) => character.id === currentSpeaker.session_character_id)
    : null
  const currentLines = currentSpeaker?.messages ?? []
  const currentLine = frozen
    ? currentLines[Math.min(lineIndex, Math.max(0, currentLines.length - 1))] ?? ''
    : currentLines[lineIndex] ?? ''

  useEffect(() => {
    onActiveSpeakerChange?.(isLoading ? null : currentSpeaker ?? null)
  }, [currentSpeaker, isLoading, onActiveSpeakerChange])

  const handleLineDone = () => {
    if (frozen) return
    if (lineIndex + 1 < currentLines.length) {
      setLineIndex((current) => current + 1)
      return
    }
    if (currentSpeaker?.session_character_id) onSpeakerFinished?.(currentSpeaker.session_character_id)
    if (speakerIndex + 1 < speakers.length) {
      setSpeakerIndex((current) => current + 1)
      setLineIndex(0)
      return
    }
    setFrozen(true)
    onAllDone?.()
  }

  const isNarration = currentSpeaker?.speaker_type === 'narrator'
  const speakerLabel = currentCharacter?.name ?? ' '

  return (
    <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', width: 'min(1050px, 90vw)', height: '9rem', background: 'linear-gradient(135deg, rgba(255,211,225,0.96), rgba(255,182,193,0.96))', border: '3px solid rgba(255,133,179,0.85)', borderRadius: 20, padding: '26px 20px 26px 30px', boxShadow: '0 12px 40px rgba(233,30,140,0.3)', backdropFilter: 'blur(8px)', zIndex: 70, pointerEvents: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      {!isNarration && (
        <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(180deg,rgba(255,235,245,1),rgba(255,194,220,1))', color: '#5a1a4a', border: '2px solid rgba(255,133,179,0.9)', borderRadius: 999, padding: '4px 16px', fontFamily: 'var(--font-display,sans-serif)', fontSize: 16, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {isLoading ? '...' : speakerLabel}
        </div>
      )}
      <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {isLoading ? (
          <LoadingDots />
        ) : currentLine ? (
          <SpeakerLine key={`${speakerIndex}-${lineIndex}-${currentLine.slice(0, 20)}`} text={currentLine} onDone={handleLineDone} autoPlay={autoPlay} />
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}
