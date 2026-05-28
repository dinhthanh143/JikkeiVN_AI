import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ApiError,
  deleteSession,
  getLatestSessionByScene,
  getSceneForPlay,
  getSession,
  listSessionBackgrounds,
  redoTurn,
  setSessionStartingBackground,
  startSession,
  submitTurn,
  type BackgroundRecord,
  type SceneDetailRecord,
  type SessionCharacterRecord,
  type SessionRecord,
  type TurnMessageRecord,
} from '@/services/backendApi'
import { useCredits } from '@/features/credits/useCredits'
import { useGameStore } from '@/store/useGameStore'
import { initialExpressionMap } from './storyPresentation'
import type { StoryEnding, StoryInitState, StoryInputType, StoryPanelView, TurnSubmitResult } from './types'

const ERROR_MESSAGE: TurnMessageRecord = {
  id: 'error',
  turn_id: '',
  session_character_id: null,
  speaker_type: 'narrator',
  messages: ['Something went wrong. Please try again.'],
  expression_key: null,
  speaker_order: 0,
  created_at: '',
}

function orderedMessages(session: SessionRecord): TurnMessageRecord[] {
  const opening = [...(session.turn_zero_messages ?? [])].sort((a, b) => a.speaker_order - b.speaker_order)
  const latest = [...(session.latest_turn_messages ?? [])].sort((a, b) => a.speaker_order - b.speaker_order)
  return latest.length > 0 ? latest : opening
}

function mergeAuthoritativeCharacters(
  current: SessionCharacterRecord[],
  authoritative: SessionCharacterRecord[],
  messages: TurnMessageRecord[],
): SessionCharacterRecord[] {
  const deferredIds = new Set(
    messages
      .filter((message) => message.resulting_status != null || message.resulting_is_active != null)
      .map((message) => message.session_character_id)
      .filter((id): id is string => id !== null),
  )

  return authoritative.map((next) => {
    const previous = current.find((character) => character.id === next.id)
    if (!previous || !deferredIds.has(next.id)) return next
    return { ...next, status: previous.status, is_active: previous.is_active }
  })
}

export function useStoryController(storyId: string | undefined) {
  const navigate = useNavigate()
  const [initState, setInitState] = useState<StoryInitState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [scene, setScene] = useState<SceneDetailRecord | null>(null)
  const [backgrounds, setBackgrounds] = useState<BackgroundRecord[]>([])
  const [currentBgUrl, setCurrentBgUrl] = useState<string | null>(null)
  const [ending, setEnding] = useState<StoryEnding | null>(null)
  const [pendingEnding, setPendingEnding] = useState<StoryEnding | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [panelView, setPanelView] = useState<StoryPanelView>('menu')
  const [isRestarting, setIsRestarting] = useState(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
  const [visibleExpressions, setVisibleExpressions] = useState<Record<string, string | null>>({})
  const [showCreditsExhausted, setShowCreditsExhausted] = useState(false)
  const [isChangingBackground, setIsChangingBackground] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  const backgroundTimer = useRef<number | null>(null)
  const panelTimer = useRef<number | null>(null)
  const notificationTimer = useRef<number | null>(null)
  const lastRemoteSync = useRef(0)
  const initializationRequest = useRef<{
    storyId: string
    promise: Promise<{
      sceneData: SceneDetailRecord
      activeSession: SessionRecord
      sessionBackgrounds: BackgroundRecord[]
    }>
  } | null>(null)
  const { credits, refetch: refetchCredits, decrement: decrementCredits } = useCredits()

  const game = useGameStore()
  const {
    session, sessionChars, currentSpeakers, pendingChoices, showChoices,
    isAiLoading, isBgTransitioning, canRedo, isRedoing, hasAIError,
    lastFailedInput, lastFailedInputType, isLockedByOtherTab, remoteSyncNonce,
    initSession, applyTurnResult, setSpeakers, setPendingChoices, setShowChoices,
    setBgTransitioning, setCurrentBg, setRedoing, setAIError, clearAIError,
    lockTurn, unlockTurn, resetGame, applyPendingCharChange,
  } = game

  const hydrateSession = useCallback((record: SessionRecord, messages = orderedMessages(record)) => {
    initSession(record)
    setSpeakers(messages)
    setPendingChoices(record.current_choices ?? [])
    setCurrentBgUrl(record.current_background?.image_url ?? null)
    setVisibleExpressions(initialExpressionMap(record.session_characters ?? []))
    if (!record.is_active) {
      setEnding({ outcome: record.outcome, message: record.outcome_message })
    } else if (messages.length === 0 && (record.current_choices?.length ?? 0) > 0) {
      setShowChoices(true)
    }
  }, [initSession, setPendingChoices, setShowChoices, setSpeakers])

  useEffect(() => {
    if (!storyId) {
      setErrorMsg('Story not found')
      setInitState('error')
      return
    }

    let cancelled = false
    setInitState('loading')
    setEnding(null)
    setPendingEnding(null)

    if (initializationRequest.current?.storyId !== storyId) {
      const promise = (async () => {
        const sceneData = await getSceneForPlay(storyId)
        let activeSession = await getLatestSessionByScene(storyId)
        if (!activeSession) activeSession = await startSession(storyId)
        const sessionBackgrounds = await listSessionBackgrounds(activeSession.id).catch(() => sceneData.backgrounds)
        return { sceneData, activeSession, sessionBackgrounds }
      })()
      initializationRequest.current = { storyId, promise }
    }

    const initialize = async () => {
      try {
        const result = await initializationRequest.current!.promise
        if (cancelled) return
        const { sceneData, activeSession, sessionBackgrounds } = result
        setScene(sceneData)
        setBackgrounds(sessionBackgrounds)
        hydrateSession(activeSession)
        setInitState('ready')
      } catch (error) {
        if (cancelled) return
        setErrorMsg(error instanceof Error ? error.message : 'Failed to load story')
        setInitState('error')
      }
    }

    void initialize()
    return () => {
      cancelled = true
      if (backgroundTimer.current !== null) window.clearTimeout(backgroundTimer.current)
      if (panelTimer.current !== null) window.clearTimeout(panelTimer.current)
      if (notificationTimer.current !== null) window.clearTimeout(notificationTimer.current)
      resetGame()
    }
  }, [hydrateSession, resetGame, storyId])

  useEffect(() => {
    if (!session || remoteSyncNonce === 0 || remoteSyncNonce === lastRemoteSync.current) return
    lastRemoteSync.current = remoteSyncNonce
    let cancelled = false

    const synchronize = async () => {
      try {
        const refreshed = await getSession(session.id)
        if (!cancelled) hydrateSession(refreshed)
      } catch {
        // The other tab may have ended or restarted the session. Reload the
        // route so the latest-by-scene initialization path resolves it safely.
        if (!cancelled) window.location.reload()
      }
    }
    void synchronize()
    return () => { cancelled = true }
  }, [hydrateSession, remoteSyncNonce, session])

  const transitionBackground = useCallback((background: BackgroundRecord) => {
    if (background.image_url === currentBgUrl) return
    if (backgroundTimer.current !== null) window.clearTimeout(backgroundTimer.current)
    setBgTransitioning(true)
    setCurrentBg(background, background.id)
    setCurrentBgUrl(background.image_url)
    backgroundTimer.current = window.setTimeout(() => {
      setBgTransitioning(false)
      backgroundTimer.current = null
    }, 900)
  }, [currentBgUrl, setBgTransitioning, setCurrentBg])

  const applyResult = useCallback((result: Awaited<ReturnType<typeof submitTurn>>) => {
    const authoritativeChars = result.session_characters ?? []
    const updatedChars = authoritativeChars.length > 0
      ? mergeAuthoritativeCharacters(sessionChars, authoritativeChars, result.turn_messages)
      : sessionChars

    applyTurnResult({
      sessionState: {
        turnCount: result.session_state.turn_count,
        isActive: result.session_state.is_active,
        worldEvents: result.session_state.world_events,
        historySummary: result.session_state.history_summary,
        outcome: result.session_state.outcome,
        outcomeMessage: result.session_state.outcome_message,
        currentBackgroundId: result.session_state.current_background_id,
        currentBackground: result.session_state.current_background,
      },
      turnMessages: result.turn_messages,
      optionsPresented: result.options_presented,
      updatedChars,
    })

    const nextBackground = result.session_state.current_background
    if (nextBackground?.image_url && nextBackground.image_url !== currentBgUrl) {
      transitionBackground(nextBackground)
    }

    const speakerIds = new Set(
      result.turn_messages
        .map((message) => message.session_character_id)
        .filter((id): id is string => id !== null),
    )
    for (const characterId of Object.keys(useGameStore.getState().pendingCharChanges)) {
      if (!speakerIds.has(characterId)) applyPendingCharChange(characterId)
    }

    if (!result.session_state.is_active) {
      const nextEnding = {
        outcome: result.session_state.outcome ?? null,
        message: result.session_state.outcome_message ?? null,
      }
      if (result.turn_messages.length > 0) setPendingEnding(nextEnding)
      else setEnding(nextEnding)
    }
  }, [applyPendingCharChange, applyTurnResult, currentBgUrl, sessionChars, transitionBackground])

  const handleTurnSubmit = useCallback(async (
    playerInput: string,
    inputType: StoryInputType = 'prompt',
  ): Promise<TurnSubmitResult> => {
    if (!session || isAiLoading || isLockedByOtherTab) return { ok: false, message: 'The story is busy.' }
    lockTurn()
    clearAIError()
    try {
      const result = await submitTurn({ session_id: session.id, input_type: inputType, player_input: playerInput })
      applyResult(result)
      decrementCredits()
      return { ok: true }
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        void refetchCredits()
        setShowCreditsExhausted(true)
        return { ok: false, message: 'You are out of credits for now.' }
      }
      setSpeakers([ERROR_MESSAGE])
      setAIError(playerInput, inputType)
      return { ok: false, message: error instanceof Error ? error.message : 'Turn failed. Please try again.' }
    } finally {
      unlockTurn()
    }
  }, [applyResult, clearAIError, decrementCredits, isAiLoading, isLockedByOtherTab, lockTurn, refetchCredits, session, setAIError, setSpeakers, unlockTurn])

  const handleRetry = useCallback(() => {
    if (!lastFailedInput || !lastFailedInputType) return
    void handleTurnSubmit(lastFailedInput, lastFailedInputType)
  }, [handleTurnSubmit, lastFailedInput, lastFailedInputType])

  const showNotification = useCallback((message: string) => {
    if (notificationTimer.current !== null) window.clearTimeout(notificationTimer.current)
    setNotification(message)
    notificationTimer.current = window.setTimeout(() => {
      setNotification(null)
      notificationTimer.current = null
    }, 2600)
  }, [])

  const handleRedo = useCallback(async () => {
    if (!session || !canRedo || isAiLoading || isLockedByOtherTab) return
    let succeeded = false
    const previousEnding = ending
    setEnding(null)
    setRedoing(true)
    lockTurn()
    clearAIError()
    try {
      const result = await redoTurn(session.id)
      applyResult(result)
      decrementCredits()
      succeeded = true
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        void refetchCredits()
        setShowCreditsExhausted(true)
        showNotification('Redo failed — you are out of credits for now.')
      } else {
        showNotification(error instanceof Error && error.message
          ? `Redo failed — ${error.message}`
          : 'Redo failed. Please try again.')
      }
    } finally {
      unlockTurn()
      if (!succeeded) {
        setRedoing(false)
        setEnding(previousEnding)
      }
    }
  }, [applyResult, canRedo, clearAIError, decrementCredits, ending, isAiLoading, isLockedByOtherTab, lockTurn, refetchCredits, session, setRedoing, showNotification, unlockTurn])

  const handleDialogueDone = useCallback(() => {
    setActiveSpeakerId(null)
    if (pendingEnding) {
      setEnding(pendingEnding)
      setPendingEnding(null)
      return
    }
    if (pendingChoices.length > 0) setShowChoices(true)
  }, [pendingChoices.length, pendingEnding, setShowChoices])

  const handleActiveSpeakerChange = useCallback((message: TurnMessageRecord | null) => {
    const characterId = message?.session_character_id ?? null
    setActiveSpeakerId(characterId)
    if (characterId && message?.expression_key) {
      setVisibleExpressions((current) => ({ ...current, [characterId]: message.expression_key }))
    }
  }, [])

  const handleManualBackgroundChange = useCallback(async (background: BackgroundRecord) => {
    if (!session || isChangingBackground) return
    setIsChangingBackground(true)
    try {
      await setSessionStartingBackground(session.id, background.id)
      transitionBackground(background)
    } finally {
      setIsChangingBackground(false)
    }
  }, [isChangingBackground, session, transitionBackground])

  const handleExpressionPreview = useCallback((characterId: string, expressionKey: string) => {
    setVisibleExpressions((current) => ({ ...current, [characterId]: expressionKey }))
  }, [])

  const handlePanelToggle = useCallback(() => {
    if (isPanelOpen) {
      setIsPanelOpen(false)
      panelTimer.current = window.setTimeout(() => setPanelView('menu'), 350)
    } else {
      setIsPanelOpen(true)
    }
  }, [isPanelOpen])

  const handleRestart = useCallback(async () => {
    if (!session || !storyId || isRestarting) return
    setIsRestarting(true)
    try {
      await deleteSession(session.id)
      await startSession(storyId)
      window.location.reload()
    } catch {
      setIsRestarting(false)
      setShowRestartConfirm(false)
    }
  }, [isRestarting, session, storyId])

  const activeChars = sessionChars
    .filter((character) => character.is_active && character.status === 'active')
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  return {
    initState, errorMsg, scene, backgrounds, currentBgUrl, ending,
    showSettingsModal, setShowSettingsModal,
    isPanelOpen, panelView, setPanelView, handlePanelToggle,
    isRestarting, showRestartConfirm, setShowRestartConfirm, handleRestart,
    activeSpeakerId, visibleExpressions, handleExpressionPreview,
    showCreditsExhausted, setShowCreditsExhausted, credits,
    notification,
    isChangingBackground, handleManualBackgroundChange,
    session, sessionChars, activeChars, currentSpeakers, pendingChoices, showChoices,
    setShowChoices, isAiLoading, isBgTransitioning, canRedo, isRedoing,
    hasAIError, lastFailedInput, lastFailedInputType, isLockedByOtherTab,
    handleTurnSubmit, handleRetry, handleRedo, handleDialogueDone,
    handleActiveSpeakerChange, applyPendingCharChange,
    navigate,
  }
}

export type StoryController = ReturnType<typeof useStoryController>
