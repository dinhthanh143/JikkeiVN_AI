import { describe, expect, it } from 'vitest'
import type { SceneDetailRecord, SessionCharacterRecord } from '@/services/backendApi'
import { getCharacterStageStyle, resolveStorySprite } from './storyPresentation'

const scene = {
  characters: [{
    id: 'template-1',
    avatar_url: 'template-avatar.png',
    expressions: [
      { slot_key: 'happy', image_url: 'template-happy.png', is_default: false },
      { slot_key: 'neutral', image_url: 'template-neutral.png', is_default: true },
    ],
  }],
} as SceneDetailRecord

const character = {
  id: 'session-1',
  source_character_id: 'template-1',
  avatar_url: 'session-avatar.png',
  current_expression_key: 'happy',
  expressions: [],
} as unknown as SessionCharacterRecord

describe('story presentation assets', () => {
  it('uses the selected expression before the avatar', () => {
    expect(resolveStorySprite(character, scene, 'happy')).toBe('template-happy.png')
  })

  it('uses personalized session expressions without a template character', () => {
    const personalized = {
      ...character,
      source_character_id: null,
      expressions: [{
        id: 'expression-1', session_character_id: character.id, slot_key: 'smile',
        display_name: 'Smile', image_url: 'personalized-smile.png', is_default: true, display_order: 0,
      }],
    }
    expect(resolveStorySprite(personalized, scene, 'smile')).toBe('personalized-smile.png')
  })

  it('places two characters symmetrically', () => {
    expect(getCharacterStageStyle(0, 2).left).toBe('32%')
    expect(getCharacterStageStyle(1, 2).left).toBe('68%')
  })
})
