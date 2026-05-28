import type { SceneDetailRecord, SessionRecord, BackgroundRecord } from '../../services/backendApi'
import type { CharacterDraft, BackgroundDraft, WizardData } from './types'

export function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`
}

export function buildBlankCharacter(isOriginal = false): CharacterDraft {
  return {
    id: makeId(),
    existingId: null,
    isOriginal,
    name: '',
    description: '',
    initialDialogue: '',
    avatarUrl: null,
    avatarPreview: null,
    avatarFile: null,
    isGenerated: false,
    expressions: [],
    activeExpressionSlot: '',
    attributes: [],
  }
}

export function buildInitialWizardData(): WizardData {
  return {
    title: '',
    description: '',
    gameMode: 'normal',
    isNsfw: false,
    tier: 'free',
    isPublic: false,
    characters: [buildBlankCharacter()],
    backgrounds: [],
    startingBackgroundId: null,
    startChoices: [{ id: makeId(), existingId: null, choiceText: '' }],
  }
}

export function hydrateWizardData(scene: SceneDetailRecord): WizardData {
  const characters: CharacterDraft[] = scene.characters.map((c) => ({
    id: c.id,
    existingId: c.id,
    isOriginal: true,
    name: c.name,
    description: c.description,
    initialDialogue: c.initial_dialogue ?? '',
    avatarUrl: c.avatar_url,
    avatarPreview: null,
    avatarFile: null,
    isGenerated: false,
    expressions: c.expressions.map((e) => ({
      slotKey: e.slot_key,
      displayName: e.display_name,
      imageUrl: e.image_url,
      preview: null,
      file: null,
    })),
    activeExpressionSlot: c.expressions[0]?.slot_key ?? '',
    attributes: c.attributes.map((a) => ({
      attrKey: a.attr_key,
      initialValue: a.initial_value,
      minValue: a.min_value,
      maxValue: a.max_value,
    })),
  }))

  const backgrounds: BackgroundDraft[] = scene.backgrounds.map((b) => ({
    id: b.id,
    existingId: b.id,
    isOriginal: true,
    name: b.name,
    imageUrl: b.image_url,
    preview: null,
    file: null,
  }))

  return {
    title: scene.title,
    description: scene.description ?? '',
    gameMode: scene.game_mode,
    isNsfw: scene.is_nsfw,
    tier: scene.tier,
    isPublic: scene.is_public,
    characters: characters.length > 0 ? characters : [buildBlankCharacter()],
    backgrounds,
    startingBackgroundId: scene.starting_background_id ?? (backgrounds[0]?.id ?? null),
    startChoices: [],
  }
}

/**
 * Personalized-mode equivalent of hydrateWizardData. Builds WizardData from
 * the SESSION's actual SessionCharacter rows (which may include previous
 * personalized overrides and session-only additions from an earlier edit),
 * not from the scene's template Character rows — hydrateWizardData() alone
 * would silently discard a returning player's prior personalization on
 * every page load, since it has no way to know about SessionCharacter at all.
 *
 * Backgrounds still come from the scene (template backgrounds are shown as
 * isOriginal: true, exactly like hydrateWizardData) plus the session's own
 * personalized backgrounds layered on top as isOriginal: false.
 *
 * startChoices is always empty — personalized mode has no start-choices
 * step (see PERS_STEP_DEFS in types.ts; removed per product decision).
 *
 * sessionBackgrounds should come from listSessionBackgrounds(), NOT
 * scene.backgrounds — the latter only ever contains template backgrounds
 * (session_id IS NULL), so it would silently omit any personalized
 * backgrounds the player already added in a previous edit.
 */
export function hydratePersonalizedWizardData(
  scene: SceneDetailRecord, session: SessionRecord, sessionBackgrounds: BackgroundRecord[],
): WizardData {
  const characters: CharacterDraft[] = session.session_characters.map((sc) => ({
    id: sc.id,
    existingId: sc.id,
    isOriginal: !sc.is_session_only,
    name: sc.name,
    description: sc.description ?? '',
    initialDialogue: sc.initial_dialogue ?? '',
    avatarUrl: sc.avatar_url,
    avatarPreview: null,
    avatarFile: null,
    isGenerated: false,
    expressions: sc.expressions.map((e) => ({
      slotKey: e.slot_key,
      displayName: e.display_name,
      imageUrl: e.image_url,
      preview: null,
      file: null,
    })),
    activeExpressionSlot: sc.expressions[0]?.slot_key ?? '',
    // Session-only characters have no template CharacterAttribute rows (no
    // min/max/display metadata exists for them) — attribute_values is a flat
    // {key: value} map, so min/max are defaulted to a wide 0-100 range here
    // purely for the slider UI; the backend never enforces these bounds for
    // session characters (see SessionCharacterAttributeUpdateRequest).
    attributes: Object.entries(sc.attribute_values ?? {}).map(([attrKey, initialValue]) => ({
      attrKey, initialValue, minValue: 0, maxValue: 100,
    })),
  }))

  // isOriginal = true for template backgrounds (session_id null), false for
  // this session's own personalized backgrounds — mirrors how characters
  // distinguish is_session_only above.
  const backgrounds: BackgroundDraft[] = sessionBackgrounds.map((b) => ({
    id: b.id, existingId: b.id, isOriginal: !b.session_id,
    name: b.name, imageUrl: b.image_url, preview: null, file: null,
  }))

  return {
    title: scene.title,
    description: scene.description ?? '',
    gameMode: scene.game_mode,
    isNsfw: scene.is_nsfw,
    tier: scene.tier,
    isPublic: scene.is_public,
    characters: characters.length > 0 ? characters : [buildBlankCharacter()],
    backgrounds,
    startingBackgroundId: session.current_background_id ?? scene.starting_background_id ?? (backgrounds[0]?.id ?? null),
    startChoices: [],
  }
}
