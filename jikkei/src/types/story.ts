import type { CharacterExpression, CharacterPose } from './character'

export interface Choice {
  id: string
  text: string
  nextNodeId: string
  affinityDelta: number
}

export const SceneEffect = {
  Vignette: 'vignette',
  ScreenShake: 'screenShake',
  Flash: 'flash',
  Heartbeat: 'heartbeat',
  StaticNoise: 'staticNoise',
} as const

export type SceneEffect = (typeof SceneEffect)[keyof typeof SceneEffect]

export interface StoryNode {
  id: string
  background: string
  characterId: string
  expression: CharacterExpression
  pose: CharacterPose
  dialogue: string
  choices: Choice[]
  music: string
  effects: SceneEffect[]
}

export interface Story {
  id: string
  title: string
  description: string
  coverImage: string
  characters: string[]
  nodes: StoryNode[]
  tags: string[]
  isAIDriven: boolean
}
