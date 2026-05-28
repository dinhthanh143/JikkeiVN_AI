import type { TurnRequest } from '@/services/backendApi'

export type StoryInitState = 'loading' | 'ready' | 'error'
export type StoryPanelView = 'menu' | 'game-controls' | 'summary'

export interface StoryEnding {
  outcome: string | null
  message: string | null
}

export interface TurnSubmitResult {
  ok: boolean
  message?: string
}

export type StoryInputType = TurnRequest['input_type']
