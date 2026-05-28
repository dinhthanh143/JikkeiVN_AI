export const CharacterExpression = {
  Neutral: 'neutral',
  Happy: 'happy',
  Sad: 'sad',
  Angry: 'angry',
  Flustered: 'flustered',
  Shocked: 'shocked',
  Crying: 'crying',
  Yandere: 'yandere',
  Shy: 'shy',
  Smug: 'smug',
} as const

export type CharacterExpression = (typeof CharacterExpression)[keyof typeof CharacterExpression]

export const CharacterPose = {
  Idle: 'idle',
  ArmsCrossed: 'arms_crossed',
  Reaching: 'reaching',
  Sitting: 'sitting',
  TurnedAway: 'turned_away',
} as const

export type CharacterPose = (typeof CharacterPose)[keyof typeof CharacterPose]

export interface CharacterVisuals {
  portrait: string
  expressions: Record<CharacterExpression, string>
  poses: Record<CharacterPose, string>
  colorPalette: string[]
}

export interface LoreEntry {
  id: string
  keys: string[]
  content: string
  priority: number
}

export interface CharacterCard {
  id: string
  name: string
  description: string
  personality: string
  scenario: string
  firstMessage: string
  lorebook: LoreEntry[]
  visual: CharacterVisuals
  tags: string[]
  creatorId: string
  createdAt: Date
  isPublic: boolean
}
