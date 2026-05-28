import { beforeEach, describe, expect, it } from 'vitest'
import type { SessionCharacterRecord, SessionRecord, TurnMessageRecord } from '@/services/backendApi'
import { useGameStore } from './useGameStore'

const character = {
  id: 'character-1',
  status: 'active',
  is_active: true,
  attribute_values: { affection: 10 },
} as unknown as SessionCharacterRecord

const session = {
  id: 'session-1',
  scene_id: 'scene-1',
  game_mode: 'normal',
  turn_count: 1,
  is_active: true,
  current_background_id: null,
  current_background: null,
  world_events: [],
  history_summary: null,
  outcome: null,
  outcome_message: null,
  current_choices: ['Stay'],
  session_characters: [character],
} as unknown as SessionRecord

describe('useGameStore turn safety', () => {
  beforeEach(() => useGameStore.getState().resetGame())

  it('keeps pending choices while a request is in flight', () => {
    useGameStore.getState().initSession(session)
    useGameStore.getState().lockTurn()
    expect(useGameStore.getState().pendingChoices).toEqual(['Stay'])
  })

  it('defers presence changes until the dialogue cue finishes', () => {
    useGameStore.getState().initSession(session)
    const message = {
      id: 'message-1', session_character_id: character.id,
      resulting_status: 'inactive', resulting_is_active: false,
      speaker_order: 0,
    } as unknown as TurnMessageRecord

    useGameStore.getState().applyTurnResult({
      sessionState: { turnCount: 2 },
      turnMessages: [message],
      optionsPresented: [],
      updatedChars: [{ ...character, attribute_values: { affection: 25 } }],
    })

    expect(useGameStore.getState().sessionChars[0]?.attribute_values.affection).toBe(25)
    expect(useGameStore.getState().sessionChars[0]?.is_active).toBe(true)

    useGameStore.getState().applyPendingCharChange(character.id)
    expect(useGameStore.getState().sessionChars[0]?.is_active).toBe(false)
    expect(useGameStore.getState().sessionChars[0]?.status).toBe('inactive')
  })

  it('restores redo availability after a failed redo attempt', () => {
    useGameStore.getState().initSession(session)
    useGameStore.getState().setRedoing(true)
    expect(useGameStore.getState().canRedo).toBe(false)
    useGameStore.getState().setRedoing(false)
    expect(useGameStore.getState().canRedo).toBe(true)
  })
})
