// ============================================================
// SceneCreator — shared types, constants, step definitions
// ============================================================

export type GameMode = 'normal' | 'survival'
export type EditMode = 'original' | 'personalized'

export interface ExpressionTab {
  slotKey: string
  displayName: string
  imageUrl: string | null
  preview: string | null
  file: File | null
}

export interface CharacterAttributeRow {
  attrKey: string
  initialValue: number
  minValue: number
  maxValue: number
}

export interface CharacterDraft {
  id: string
  existingId: string | null
  /** true = came from the original scene template, false = session-only addition */
  isOriginal: boolean
  name: string
  description: string
  initialDialogue: string
  avatarUrl: string | null
  avatarPreview: string | null
  avatarFile: File | null
  isGenerated: boolean
  expressions: ExpressionTab[]
  activeExpressionSlot: string
  attributes: CharacterAttributeRow[]
}

export interface BackgroundDraft {
  id: string
  existingId: string | null
  /** true = came from the original scene template */
  isOriginal: boolean
  name: string
  imageUrl: string | null
  preview: string | null
  file: File | null
}

export interface SceneStartChoiceDraft {
  id: string
  existingId: string | null
  choiceText: string
}

export interface WizardData {
  title: string
  description: string
  gameMode: GameMode
  isNsfw: boolean
  tier: 'free' | 'premium'
  isPublic: boolean
  characters: CharacterDraft[]
  backgrounds: BackgroundDraft[]
  startingBackgroundId: string | null
  startChoices: SceneStartChoiceDraft[]
}

export type ErrorMap = Record<string, string>

// ── Step definitions ─────────────────────────────────────────

export const ORIG_STEP_DEFS = [
  { key: 'basics', label: 'STORY BASICS' },
  { key: 'characters', label: 'CHARACTERS' },
  { key: 'backgrounds', label: 'BACKGROUNDS' },
  { key: 'choices', label: 'START CHOICES' },
  { key: 'review', label: 'REVIEW + SAVE' },
] as const

export const PERS_STEP_DEFS = [
  { key: 'characters', label: 'CHARACTERS' },
  { key: 'backgrounds', label: 'BACKGROUNDS' },
  { key: 'review', label: 'REVIEW' },
] as const

export type OrigStepKey = (typeof ORIG_STEP_DEFS)[number]['key']
export type PersStepKey = (typeof PERS_STEP_DEFS)[number]['key']

// ── Limits ───────────────────────────────────────────────────

export const TIER_LIMITS = {
  free:    { characters: 2, backgrounds: 2, maxStories: 5 },
  premium: { characters: 3, backgrounds: 5, maxStories: 20 },
} as const

// Separate cap for Personalized story edit — how many SESSION-ONLY
// (player-added) characters one session may have. Must match the backend's
// MAX_SESSION_CHARACTERS_FREE / MAX_SESSION_CHARACTERS_PREMIUM in
// app/core/config.py exactly; this is a client-side mirror for instant UI
// feedback only — the backend's check_session_character_limit is the real
// enforcement and will 403 regardless of what this constant says.
export const PERSONALIZED_CHARACTER_LIMITS = {
  free: 2,
  premium: 4,
} as const

export const MAX_START_CHOICES = 3
export const MAX_ATTRIBUTES = 5
export const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// ── Edit mode guide modal ────────────────────────────────────
// Shown once on first entry into edit mode (not creation), explaining the
// difference between Original and Personalized story edit. Dismissal is
// remembered via this localStorage key + the "Do not show again" checkbox.
export const EDIT_MODE_GUIDE_STORAGE_KEY = 'jikkei:editModeGuideDismissed'
