import type { CSSProperties } from 'react'
import type { SceneDetailRecord, SessionCharacterRecord } from '@/services/backendApi'

function expressionImage(
  char: SessionCharacterRecord,
  scene: SceneDetailRecord,
  expressionKey: string | null,
): string | null {
  const template = scene.characters.find((candidate) => candidate.id === char.source_character_id)

  // "neutral" is a reserved slot key that never lives as a row in
  // character_expressions/session_character_expressions — it always maps
  // directly to the character's avatar_url. This guarantees every character
  // has a safe resting face without requiring an author to explicitly
  // create + flag a "neutral" expression, and without depending on
  // is_default (which is set purely by array position on save, not by any
  // actual semantic meaning — see replace_character_expressions).
  if (expressionKey === 'neutral') {
    return char.avatar_url ?? template?.avatar_url ?? null
  }

  const sessionExpressions = char.expressions ?? []
  const templateExpressions = template?.expressions ?? []
  const expressions = sessionExpressions.length > 0 ? sessionExpressions : templateExpressions

  if (expressionKey) {
    const selected = expressions.find((expression) => expression.slot_key === expressionKey)
    if (selected?.image_url) return selected.image_url
  }

  // No expressionKey, or it matched nothing real (e.g. a stale/legacy key
  // from before "neutral" became reserved). resolveStorySprite's own
  // fallback chain (?? char.avatar_url) catches this null.
  return null
}

export function resolveStorySprite(
  char: SessionCharacterRecord,
  scene: SceneDetailRecord,
  visibleExpressionKey: string | null,
): string | null {
  return expressionImage(char, scene, visibleExpressionKey)
    ?? char.avatar_url
    ?? scene.characters.find((candidate) => candidate.id === char.source_character_id)?.avatar_url
    ?? null
}

export function getStoryExpressionOptions(char: SessionCharacterRecord, scene: SceneDetailRecord) {
  if (char.expressions.length > 0) return char.expressions
  return scene.characters.find((candidate) => candidate.id === char.source_character_id)?.expressions ?? []
}

export function getCharacterStageStyle(index: number, total: number): CSSProperties {
  if (total <= 1) return { left: '50%' }
  if (total === 2) return { left: index === 0 ? '32%' : '68%' }
  if (total === 3) return { left: ['22%', '50%', '78%'][index] ?? '50%' }

  const left = 12 + (76 * index) / Math.max(1, total - 1)
  return { left: `${left}%` }
}

export function initialExpressionMap(characters: SessionCharacterRecord[]): Record<string, string | null> {
  return Object.fromEntries(characters.map((character) => [character.id, character.current_expression_key]))
}
