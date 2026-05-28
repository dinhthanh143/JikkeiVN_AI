import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TurnMessageRecord } from '@/services/backendApi'
import DialogueBox from './DialogueBox'
import { getAutoAdvanceDelay } from './dialogueTiming'

vi.mock('@/audio/sfx', () => ({ playTextPlip: vi.fn() }))

const narration: TurnMessageRecord = {
  id: 'narration-1',
  turn_id: 'turn-1',
  session_character_id: null,
  speaker_type: 'narrator',
  messages: ['Rain traced the window.'],
  expression_key: null,
  speaker_order: 0,
  created_at: '2026-07-13T00:00:00Z',
}

describe('DialogueBox auto advance timing', () => {
  it('gives short text at least one and a half seconds', () => {
    expect(getAutoAdvanceDelay('Hi.')).toBe(1_500)
  })

  it('scales reading time with text length', () => {
    expect(getAutoAdvanceDelay('A'.repeat(100))).toBe(3_200)
  })

  it('caps very long pages at five seconds', () => {
    expect(getAutoAdvanceDelay('A'.repeat(1_000))).toBe(5_000)
  })

  it('does not render a name header for narration', () => {
    render(<DialogueBox speakers={[narration]} sessionChars={[]} />)

    expect(screen.queryByText('NARRATION')).not.toBeInTheDocument()
  })
})
