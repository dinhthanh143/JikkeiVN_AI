/**
 * useGameStore — single source of truth for an active play session.
 *
 * Replaces the old node-graph store (currentNodeId, affinityScores, etc.)
 * with the real backend session shape.
 *
 * BroadcastChannel tab lock:
 *   When a turn is submitted, we broadcast { type: 'TURN_LOCK', sessionId }
 *   so other tabs on the same session disable their submit button.
 *   On turn complete / error we broadcast { type: 'TURN_UNLOCK', sessionId }.
 *   If a tab crashes mid-turn the lock auto-expires after LOCK_TTL_MS.
 */

import { create } from 'zustand'
import type {
  SessionRecord,
  SessionCharacterRecord,
  TurnMessageRecord,
  BackgroundRecord,
} from '@/services/backendApi'

// ── BroadcastChannel lock ────────────────────────────────────────────────────

const CHANNEL_NAME = 'jikkei_session_lock'
const LOCK_TTL_MS  = 120_000

type LockMsg =
  | { type: 'TURN_LOCK';   sessionId: string; ts: number }
  | { type: 'TURN_UNLOCK'; sessionId: string }

let _channel: BroadcastChannel | null = null
let _lockExpiry: ReturnType<typeof setTimeout> | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null
  if (!_channel) _channel = new BroadcastChannel(CHANNEL_NAME)
  return _channel
}

function broadcastLock(sessionId: string) {
  getChannel()?.postMessage({ type: 'TURN_LOCK', sessionId, ts: Date.now() } satisfies LockMsg)
}

function broadcastUnlock(sessionId: string) {
  getChannel()?.postMessage({ type: 'TURN_UNLOCK', sessionId } satisfies LockMsg)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionSlice {
  id: string
  sceneId: string
  gameMode: 'normal' | 'survival'
  turnCount: number
  isActive: boolean
  currentBackgroundId: string | null
  currentBackground: BackgroundRecord | null
  worldEvents: string[]
  historySummary: string | null
  outcome: string | null
  outcomeMessage: string | null
}

export interface GameState {
  // ── Session ────────────────────────────────────────────────────────────────
  session: SessionSlice | null
  sessionChars: SessionCharacterRecord[]
  currentSpeakers: TurnMessageRecord[]
  pendingChoices: string[]

  // ── TASK-009: deferred presence changes ──────────────────────────────────────
  // Per-session_character_id pending status/is_active change from the most
  // recent turn, NOT yet applied to sessionChars. Populated by applyTurnResult
  // from TurnMessageRecord.resulting_status / resulting_is_active. Resolved
  // (merged into sessionChars + removed from here) either by
  // applyPendingCharChange — called when that character's dialogue block
  // finishes playing in DialogueBox (onSpeakerFinished), or immediately by
  // StoryPage.applyResult for characters with no speaker block this turn.
  pendingCharChanges: Record<string, { status?: string; is_active?: boolean }>

  // ── UI flags ───────────────────────────────────────────────────────────────
  isPlaying: boolean
  isAiLoading: boolean
  showChoices: boolean
  isBgTransitioning: boolean

  // ── Redo ───────────────────────────────────────────────────────────────────
  canRedo: boolean      // false until the first generated turn, false after redo, false in survival
  isRedoing: boolean

  // ── Retry ──────────────────────────────────────────────────────────────────
  hasAIError: boolean
  lastFailedInput: string | null
  lastFailedInputType: 'prompt' | 'option' | 'context_change' | 'redo' | 'system' | null

  // ── Tab lock (cross-tab race prevention) ──────────────────────────────────
  isLockedByOtherTab: boolean
  remoteSyncNonce: number

  // ── Actions ────────────────────────────────────────────────────────────────
  initSession:         (session: SessionRecord) => void
  applyTurnResult:     (params: ApplyTurnParams) => void
  setSpeakers:         (speakers: TurnMessageRecord[]) => void
  setPendingChoices:   (choices: string[]) => void
  setShowChoices:      (show: boolean) => void
  setAiLoading:        (loading: boolean) => void
  setBgTransitioning:  (val: boolean) => void
  setCurrentBg:        (bg: BackgroundRecord | null, id: string | null) => void
  updateSessionChars:  (updater: (chars: SessionCharacterRecord[]) => SessionCharacterRecord[]) => void
  applyPendingCharChange: (sessionCharacterId: string) => void

  setRedoing:          (val: boolean) => void
  setCanRedo:          (val: boolean) => void

  setAIError:          (input: string, inputType: GameState['lastFailedInputType']) => void
  clearAIError:        () => void

  lockTurn:            () => void    // broadcast + local loading
  unlockTurn:          () => void    // broadcast + clear loading

  resetGame:           () => void
}

export interface ApplyTurnParams {
  sessionState: Partial<SessionSlice>
  turnMessages: TurnMessageRecord[]
  optionsPresented: string[]
  updatedChars?: SessionCharacterRecord[]
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL: Omit<GameState,
  | 'initSession' | 'applyTurnResult' | 'setSpeakers' | 'setPendingChoices'
  | 'setShowChoices' | 'setAiLoading' | 'setBgTransitioning' | 'setCurrentBg'
  | 'updateSessionChars' | 'applyPendingCharChange' | 'setRedoing' | 'setCanRedo' | 'setAIError'
  | 'clearAIError' | 'lockTurn' | 'unlockTurn' | 'resetGame'
> = {
  session:             null,
  sessionChars:        [],
  currentSpeakers:     [],
  pendingChoices:      [],
  pendingCharChanges:  {},
  isPlaying:           false,
  isAiLoading:         false,
  showChoices:         false,
  isBgTransitioning:   false,
  canRedo:             false,
  isRedoing:           false,
  hasAIError:          false,
  lastFailedInput:     null,
  lastFailedInputType: null,
  isLockedByOtherTab:  false,
  remoteSyncNonce:      0,
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameState>((set, get) => {
  // ── BroadcastChannel listener ──────────────────────────────────────────────
  if (typeof window !== 'undefined') {
    const ch = getChannel()
    if (ch) {
      ch.onmessage = (event: MessageEvent<LockMsg>) => {
        const { session } = get()
        if (!session) return
        const msg = event.data
        if (msg.sessionId !== session.id) return

        if (msg.type === 'TURN_LOCK') {
          // Another tab locked this session
          set({ isLockedByOtherTab: true, isAiLoading: true })
          // Safety: auto-unlock after TTL in case that tab dies
          if (_lockExpiry) clearTimeout(_lockExpiry)
          _lockExpiry = setTimeout(() => {
            set({ isLockedByOtherTab: false, isAiLoading: false })
          }, LOCK_TTL_MS)
        } else if (msg.type === 'TURN_UNLOCK') {
          if (_lockExpiry) { clearTimeout(_lockExpiry); _lockExpiry = null }
          set((state) => ({
            isLockedByOtherTab: false,
            isAiLoading: false,
            remoteSyncNonce: state.remoteSyncNonce + 1,
          }))
        }
      }
    }
  }

  return {
    ...INITIAL,

    // ── initSession ──────────────────────────────────────────────────────────
    initSession: (record: SessionRecord) => {
      const slice: SessionSlice = {
        id:                  record.id,
        sceneId:             record.scene_id,
        gameMode:            record.game_mode,
        turnCount:           record.turn_count,
        isActive:            record.is_active,
        currentBackgroundId: record.current_background_id,
        currentBackground:   record.current_background,
        worldEvents:         record.world_events,
        historySummary:      record.history_summary,
        outcome:             record.outcome,
        outcomeMessage:      record.outcome_message,
      }
      const canRedo = record.game_mode === 'normal' && record.turn_count >= 1
      set({
        session:           slice,
        sessionChars:      record.session_characters ?? [],
        pendingChoices:    record.current_choices ?? [],
        isPlaying:         true,
        canRedo,
        currentSpeakers:   [],
        showChoices:       false,
        pendingCharChanges: {},
        isAiLoading:       false,
        isBgTransitioning: false,
        isRedoing:         false,
        hasAIError:        false,
        lastFailedInput:   null,
        lastFailedInputType: null,
      })
    },

    // ── applyTurnResult ──────────────────────────────────────────────────────
    applyTurnResult: ({ sessionState, turnMessages, optionsPresented, updatedChars }) => {
      set((state) => {
        const merged: SessionSlice = state.session
          ? { ...state.session, ...sessionState }
          : (sessionState as SessionSlice)

        const newTurnCount = merged.turnCount ?? 0
        const gameMode     = merged.gameMode ?? 'normal'
        // canRedo: normal mode, at least 2 turns, reset to false after a redo (isRedoing)
        const canRedo = gameMode === 'normal' && newTurnCount >= 1 && !state.isRedoing

        const sorted = [...turnMessages].sort((a, b) => a.speaker_order - b.speaker_order)

        // TASK-009 — pull status/is_active changes out into pendingCharChanges
        // instead of folding them into sessionChars right away. Other fields
        // (expression_key, attribute_values via updatedChars) still apply
        // immediately as before — only presence is deferred to dialogue
        // playback (see DialogueBox's onSpeakerFinished / StoryPage.applyResult).
        const newPending: Record<string, { status?: string; is_active?: boolean }> = {}
        for (const tm of turnMessages) {
          if (!tm.session_character_id) continue
          const change: { status?: string; is_active?: boolean } = {}
          if (tm.resulting_status != null) change.status = tm.resulting_status
          if (tm.resulting_is_active != null) change.is_active = tm.resulting_is_active
          if (Object.keys(change).length > 0) newPending[tm.session_character_id] = change
        }

        return {
          session:         merged,
          currentSpeakers: sorted,
          pendingChoices:  optionsPresented,
          showChoices:     false,
          sessionChars:    updatedChars ?? state.sessionChars,
          pendingCharChanges: { ...state.pendingCharChanges, ...newPending },
          canRedo,
          isRedoing:       false,
          hasAIError:      false,
          lastFailedInput: null,
          lastFailedInputType: null,
        }
      })
    },

    // ── Speakers / choices ───────────────────────────────────────────────────
    setSpeakers:       (speakers) => set({ currentSpeakers: speakers }),
    setPendingChoices: (choices)  => set({ pendingChoices: choices }),
    setShowChoices:    (show)     => set({ showChoices: show }),

    // ── Loading / BG ─────────────────────────────────────────────────────────
    setAiLoading:      (loading) => set({ isAiLoading: loading }),
    setBgTransitioning:(val)     => set({ isBgTransitioning: val }),
    setCurrentBg:      (bg, id)  => set((s) => ({
      session: s.session ? { ...s.session, currentBackground: bg, currentBackgroundId: id } : s.session,
    })),

    // ── Session chars ────────────────────────────────────────────────────────
    updateSessionChars: (updater) => set((s) => ({ sessionChars: updater(s.sessionChars) })),

    // TASK-009 — resolves one character's pending status/is_active change,
    // merging it into sessionChars and removing it from pendingCharChanges.
    // Called either when that character's dialogue block finishes playing
    // (DialogueBox's onSpeakerFinished, via StoryPage) or immediately for
    // characters with no speaker block this turn (StoryPage.applyResult).
    applyPendingCharChange: (sessionCharacterId) => set((s) => {
      const change = s.pendingCharChanges[sessionCharacterId]
      if (!change) return s
      const restPending = { ...s.pendingCharChanges }
      delete restPending[sessionCharacterId]
      return {
        sessionChars: s.sessionChars.map((c) =>
          c.id === sessionCharacterId
            ? {
                ...c,
                ...(change.status !== undefined ? { status: change.status as SessionCharacterRecord['status'] } : {}),
                ...(change.is_active !== undefined ? { is_active: change.is_active } : {}),
              }
            : c,
        ),
        pendingCharChanges: restPending,
      }
    }),

    // ── Redo ─────────────────────────────────────────────────────────────────
    setRedoing: (val) => set((state) => ({
      isRedoing: val,
      canRedo: val
        ? false
        : state.session?.gameMode === 'normal' && (state.session?.turnCount ?? 0) >= 1,
    })),
    setCanRedo: (val) => set({ canRedo: val }),

    // ── Retry ────────────────────────────────────────────────────────────────
    setAIError: (input, inputType) => set({
      hasAIError:          true,
      lastFailedInput:     input,
      lastFailedInputType: inputType,
      isAiLoading:         false,
    }),
    clearAIError: () => set({
      hasAIError:          false,
      lastFailedInput:     null,
      lastFailedInputType: null,
    }),

    // ── Tab lock ─────────────────────────────────────────────────────────────
    lockTurn: () => {
      const { session } = get()
      if (session) broadcastLock(session.id)
      set({ isAiLoading: true, showChoices: false })
    },
    unlockTurn: () => {
      const { session } = get()
      if (session) broadcastUnlock(session.id)
      set({ isAiLoading: false })
    },

    // ── Reset ────────────────────────────────────────────────────────────────
    resetGame: () => {
      const { session } = get()
      if (session) broadcastUnlock(session.id)
      if (_lockExpiry) { clearTimeout(_lockExpiry); _lockExpiry = null }
      set(INITIAL)
    },
  }
})
