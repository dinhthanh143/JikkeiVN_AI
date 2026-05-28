import { useCallback } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { MutableRefObject } from 'react'
import type { WizardData } from './types'
import { generateSceneCover } from './generateSceneCover'
import {
  createScene,
  createSceneCharacter,
  replaceCharacterExpressions,
  updateCharacterAttributes,
  createSceneBackground,
  setSceneStartingBackground,
  createStartChoice,
  uploadMediaFile,
  deleteScene,
  updateScene,
  updateSceneCharacter,
  deleteSceneCharacter,
  deleteSceneBackground,
  listStartChoices,
  deleteStartChoice,
  createSessionCharacter,
  updateSessionCharacter,
  deleteSessionCharacter,
  updateSessionCharacterAttributes,
  replaceSessionCharacterExpressions,
  setSessionStartingBackground,
  deleteSessionBackground,
} from '../../services/backendApi'

interface UseSceneSubmitOptions {
  storyId: string | undefined
  isEditMode: boolean
  editMode: 'original' | 'personalized'
  wizardData: WizardData
  navigate: NavigateFunction
  isSubmitting: boolean
  setIsSubmitting: (v: boolean) => void
  setToast: (t: { type: 'success' | 'error'; message: string } | null) => void
  removedCharIds: MutableRefObject<Set<string>>
  removedBgIds: MutableRefObject<Set<string>>
  personalizedSessionId: string | null
  personalizedCharSnapshots: MutableRefObject<Map<string, {
    name: string; description: string; avatarUrl: string | null
    position: number; initialDialogue: string | null
  }>>
}

export function useSceneSubmit({
  storyId,
  isEditMode,
  editMode,
  wizardData,
  navigate,
  isSubmitting,
  setIsSubmitting,
  setToast,
  removedCharIds,
  removedBgIds,
  personalizedSessionId,
  personalizedCharSnapshots,
}: UseSceneSubmitOptions) {

  // TASK-008: composites the starting background + character portraits into
  // a cover image, uploads it via the same Cloudinary path as backgrounds,
  // and returns the resulting URL — or null on any failure (caller should
  // simply omit scene_cover from the payload in that case, never block the
  // save). Used by submitCreate and submitEdit only; submitPersonalized
  // never calls this — Personalized story edit is scoped to a player's own
  // session, not the shared Scene row scene_cover lives on.
  const buildSceneCoverUrl = useCallback(async (sceneIdForUpload: string): Promise<string | null> => {
    try {
      const startingBg = wizardData.backgrounds.find((b) => b.id === wizardData.startingBackgroundId) ?? null
      const coverBlob = await generateSceneCover(
        wizardData.characters.map((c) => ({ file: c.avatarFile, imageUrl: c.avatarUrl })),
        startingBg ? { file: startingBg.file, imageUrl: startingBg.imageUrl } : null,
      )
      if (!coverBlob) return null
      const coverFile = new File([coverBlob], 'scene_cover.png', { type: 'image/png' })
      const u = await uploadMediaFile({ file: coverFile, folder: 'background', sceneId: sceneIdForUpload })
      return u.url
    } catch (err) {
      // Cover generation/upload is never allowed to block submit — log and
      // move on, the existing scene_cover (or null on creation) persists.
      console.error('[SceneCreatorPage] scene cover generation failed, keeping existing cover:', err)
      return null
    }
  }, [wizardData])

  const submitCreate = useCallback(async () => {
    let createdSceneId: string | null = null
    try {
      const scene = await createScene({
        title: wizardData.title.trim(),
        description: wizardData.description.trim() || null,
        game_mode: wizardData.gameMode,
        is_nsfw: wizardData.isNsfw,
        tier: wizardData.tier,
        is_public: wizardData.isPublic,
      })
      createdSceneId = scene.id

      for (let i = 0; i < wizardData.characters.length; i++) {
        const draft = wizardData.characters[i]
        if (!draft.name.trim() || !draft.description.trim()) continue
        let avatarUrl: string | null = draft.avatarUrl
        if (draft.avatarFile) {
          const u = await uploadMediaFile({ file: draft.avatarFile, folder: 'avatar', sceneId: scene.id })
          avatarUrl = u.url
        }
        const character = await createSceneCharacter(scene.id, {
          name: draft.name.trim(),
          description: draft.description.trim(),
          avatar_url: avatarUrl,
          position: i,
          initial_dialogue: draft.initialDialogue.trim() || null,
        })
        const expUrls = await Promise.all(draft.expressions.map(async (expr) => {
          let imageUrl = expr.imageUrl
          if (expr.file) {
            const u = await uploadMediaFile({ file: expr.file, folder: 'expression', sceneId: scene.id })
            imageUrl = u.url
          }
          return { slot_key: expr.slotKey, display_name: expr.displayName, image_url: imageUrl }
        }))
        if (expUrls.length > 0) await replaceCharacterExpressions(scene.id, character.id, expUrls)
        if (draft.attributes.length > 0) {
          await updateCharacterAttributes(scene.id, character.id, draft.attributes.map((a) => ({
            attr_key: a.attrKey,
            initial_value: a.initialValue,
            is_visible_to_player: true,
          })))
        }
      }

      const bgDraftToId = new Map<string, string>()
      for (const bg of wizardData.backgrounds) {
        if (!bg.file && !bg.imageUrl) continue
        let imageUrl = bg.imageUrl
        if (bg.file) {
          const u = await uploadMediaFile({ file: bg.file, folder: 'background', sceneId: scene.id })
          imageUrl = u.url
        }
        if (!imageUrl) continue
        const record = await createSceneBackground(scene.id, { name: bg.name.trim() || 'Background', image_url: imageUrl })
        bgDraftToId.set(bg.id, record.id)
      }

      if (wizardData.startingBackgroundId) {
        const sid = bgDraftToId.get(wizardData.startingBackgroundId)
        if (sid) await setSceneStartingBackground(scene.id, sid)
      }

      const filledChoices = wizardData.startChoices.filter((c) => c.choiceText.trim())
      for (let i = 0; i < filledChoices.length; i++) {
        await createStartChoice(scene.id, { choice_text: filledChoices[i].choiceText.trim(), display_order: i })
      }

      // TASK-008: auto-generate the cover now that characters/backgrounds
      // are uploaded (their Cloudinary URLs are available for the
      // already-existing-asset path, though on creation everything is
      // typically still local Files, which is the clean no-CORS path).
      const coverUrl = await buildSceneCoverUrl(scene.id)
      if (coverUrl) {
        await updateScene(scene.id, { scene_cover: coverUrl })
      }

      setToast({ type: 'success', message: 'Story created.' })
      navigate('/play', { state: { sceneCreatedName: wizardData.title.trim() } })
    } catch (err) {
      console.error('[SceneCreatorPage] submitCreate error:', err)
      if (createdSceneId) {
        try { await deleteScene(createdSceneId) } catch (ce) { console.error('rollback failed:', ce) }
      }
      setToast({ type: 'error', message: `Story not created — ${err instanceof Error ? err.message : 'Something went wrong.'}` })
    }
  }, [wizardData, navigate, setToast, buildSceneCoverUrl])

  const submitEdit = useCallback(async () => {
    if (!storyId) return
    try {
      // TASK-008: regenerate the cover every Original-mode save (characters/
      // background may have changed) and include it in the same updateScene
      // call as the rest of the scene fields. If generation fails (null),
      // scene_cover is simply omitted from the payload — the backend's
      // partial-update semantics (see update_scene in scene.py) leave the
      // existing cover untouched rather than wiping it to null.
      const coverUrl = await buildSceneCoverUrl(storyId)

      await updateScene(storyId, {
        title: wizardData.title.trim(),
        description: wizardData.description.trim() || null,
        game_mode: wizardData.gameMode,
        is_nsfw: wizardData.isNsfw,
        is_public: wizardData.isPublic,
        ...(coverUrl ? { scene_cover: coverUrl } : {}),
      })

      for (const charId of removedCharIds.current) await deleteSceneCharacter(storyId, charId)
      removedCharIds.current.clear()

      for (let i = 0; i < wizardData.characters.length; i++) {
        const draft = wizardData.characters[i]
        if (!draft.name.trim() || !draft.description.trim()) continue
        let avatarUrl: string | null = draft.avatarUrl
        if (draft.avatarFile) {
          const u = await uploadMediaFile({ file: draft.avatarFile, folder: 'avatar' })
          avatarUrl = u.url
        }
        let characterId: string
        if (draft.existingId) {
          await updateSceneCharacter(storyId, draft.existingId, {
            name: draft.name.trim(),
            description: draft.description.trim(),
            avatar_url: avatarUrl,
            position: i,
            initial_dialogue: draft.initialDialogue.trim() || null,
          })
          characterId = draft.existingId
        } else {
          const created = await createSceneCharacter(storyId, {
            name: draft.name.trim(),
            description: draft.description.trim(),
            avatar_url: avatarUrl,
            position: i,
          })
          characterId = created.id
        }
        const expUrls = await Promise.all(draft.expressions.map(async (expr) => {
          let imageUrl = expr.imageUrl
          if (expr.file) {
            const u = await uploadMediaFile({ file: expr.file, folder: 'expression', sceneId: storyId })
            imageUrl = u.url
          }
          return { slot_key: expr.slotKey, display_name: expr.displayName, image_url: imageUrl }
        }))
        await replaceCharacterExpressions(storyId, characterId, expUrls)
        if (draft.attributes.length > 0) {
          await updateCharacterAttributes(storyId, characterId, draft.attributes.map((a) => ({
            attr_key: a.attrKey,
            initial_value: a.initialValue,
            is_visible_to_player: true,
          })))
        }
      }

      for (const bgId of removedBgIds.current) await deleteSceneBackground(storyId, bgId)
      removedBgIds.current.clear()

      const bgDraftToDbId = new Map<string, string>()
      for (const bg of wizardData.backgrounds) {
        if (bg.existingId) {
          if (bg.file) {
            const u = await uploadMediaFile({ file: bg.file, folder: 'background', sceneId: storyId })
            void u
          }
          bgDraftToDbId.set(bg.id, bg.existingId)
        } else {
          if (!bg.file && !bg.imageUrl) continue
          let imageUrl = bg.imageUrl
          if (bg.file) {
            const u = await uploadMediaFile({ file: bg.file, folder: 'background', sceneId: storyId })
            imageUrl = u.url
          }
          if (!imageUrl) continue
          const record = await createSceneBackground(storyId, { name: bg.name.trim() || 'Background', image_url: imageUrl })
          bgDraftToDbId.set(bg.id, record.id)
        }
      }

      if (wizardData.startingBackgroundId) {
        const dbId = bgDraftToDbId.get(wizardData.startingBackgroundId)
        if (dbId) await setSceneStartingBackground(storyId, dbId)
      }

      const existingChoices = await listStartChoices(storyId)
      for (const c of existingChoices) await deleteStartChoice(storyId, c.id)
      const filledChoices = wizardData.startChoices.filter((c) => c.choiceText.trim())
      for (let i = 0; i < filledChoices.length; i++) {
        await createStartChoice(storyId, { choice_text: filledChoices[i].choiceText.trim(), display_order: i })
      }

      setToast({ type: 'success', message: 'Story updated.' })
      navigate(`/story/${storyId}`)
    } catch (err) {
      console.error('[SceneCreatorPage] submitEdit error:', err)
      setToast({ type: 'error', message: `Story not saved — ${err instanceof Error ? err.message : 'Something went wrong.'}` })
    }
  }, [storyId, wizardData, navigate, setToast, removedCharIds, removedBgIds, buildSceneCoverUrl])

  const submitPersonalized = useCallback(async () => {
    if (!personalizedSessionId) {
      setToast({ type: 'error', message: 'No active session for this story — play it once before personalizing.' })
      return
    }
    const sessionId = personalizedSessionId
    try {
      // ── Characters ──
      // Template-derived characters are NEVER deletable (removeCharacter
      // already blocks removing them from the draft — see useSceneCreator.ts—
      // so anything in removedCharIds here is guaranteed session-only; the
      // backend's delete_session_character would also 403 defensively if not.
      for (const charId of removedCharIds.current) await deleteSessionCharacter(sessionId, charId)
      removedCharIds.current.clear()

      for (let i = 0; i < wizardData.characters.length; i++) {
        const draft = wizardData.characters[i]
        if (!draft.name.trim() || !draft.description.trim()) continue

        // Skip unchanged existing characters entirely — no upload, no
        // update_session_character call, no lore re-embed. Without this, an
        // unrelated edit (e.g. adding a background) re-submitted EVERY
        // template-derived character on EVERY save, which was wasteful and
        // could surface a "Session character not found" error if that
        // character's existingId ever didn't resolve cleanly against the
        // current session for any reason — a problem that only existed
        // because nothing-changed characters were being sent at all.
        if (draft.existingId && !draft.avatarFile && draft.expressions.every((e) => !e.file)) {
          const snapshot = personalizedCharSnapshots.current.get(draft.existingId)
          if (
            snapshot &&
            snapshot.name === draft.name.trim() &&
            snapshot.description === draft.description.trim() &&
            snapshot.avatarUrl === draft.avatarUrl &&
            snapshot.position === i &&
            snapshot.initialDialogue === (draft.initialDialogue.trim() || null)
          ) {
            continue
          }
        }

        let avatarUrl: string | null = draft.avatarUrl
        if (draft.avatarFile) {
          const u = await uploadMediaFile({ file: draft.avatarFile, folder: 'avatar' })
          avatarUrl = u.url
        }
        let sessionCharacterId: string
        if (draft.existingId) {
          // Works for BOTH session-only and template-derived characters — a
          // personalized edit may override a template-derived character's
          // description/avatar for this player only (see
          // update_session_character's docstring in scene.py). The scene's
          // template Character row is never touched either way.
          await updateSessionCharacter(sessionId, draft.existingId, {
            name: draft.name.trim(),
            description: draft.description.trim(),
            avatar_url: avatarUrl,
            position: i,
            initial_dialogue: draft.initialDialogue.trim() || null,
          })
          sessionCharacterId = draft.existingId
        } else {
          const created = await createSessionCharacter(sessionId, {
            name: draft.name.trim(),
            description: draft.description.trim(),
            avatar_url: avatarUrl,
            position: i,
            initial_dialogue: draft.initialDialogue.trim() || null,
          })
          sessionCharacterId = created.id
        }
        const expUrls = await Promise.all(draft.expressions.map(async (expr) => {
          let imageUrl = expr.imageUrl
          if (expr.file) {
            const u = await uploadMediaFile({ file: expr.file, folder: 'expression' })
            imageUrl = u.url
          }
          return { slot_key: expr.slotKey, display_name: expr.displayName, image_url: imageUrl }
        }))
        if (expUrls.length > 0) await replaceSessionCharacterExpressions(sessionId, sessionCharacterId, expUrls)
        if (draft.attributes.length > 0) {
          await updateSessionCharacterAttributes(sessionId, sessionCharacterId, draft.attributes.map((a) => ({
            attr_key: a.attrKey,
            initial_value: a.initialValue,
          })))
        }
      }

      // ── Backgrounds ──
      // Template backgrounds (isOriginal: true) are never created/deleted
      // here — only this session's OWN backgrounds (session_id set) are
      // managed. Uses deleteSessionBackground (session-scoped), NOT
      // deleteSceneBackground (template-only, scene-scoped) — the latter
      // would either 404 (after the backend's session_id.is_(None) fix) or,
      // before that fix, could have wrongly resolved to a session-owned row
      // and deleted it without the "never zero" / "fallback if active"
      // safety checks that only the session-scoped route enforces.
      for (const bgId of removedBgIds.current) {
        try {
          await deleteSessionBackground(sessionId, bgId)
        } catch (err) {
          // 403 means this would have left the session with zero
          // backgrounds — the backend correctly refuses. Surface it instead
          // of silently swallowing, since the user's removal intent didn't
          // actually happen and they should know.
          throw new Error(
            err instanceof Error && err.message ? err.message : 'Could not remove a background — a session needs at least one.',
          )
        }
      }
      removedBgIds.current.clear()

      const bgDraftToDbId = new Map<string, string>()
      for (const bg of wizardData.backgrounds) {
        if (bg.existingId) {
          bgDraftToDbId.set(bg.id, bg.existingId)
          continue
        }
        if (!bg.file && !bg.imageUrl) continue
        let imageUrl = bg.imageUrl
        if (bg.file) {
          const u = await uploadMediaFile({ file: bg.file, folder: 'background' })
          imageUrl = u.url
        }
        if (!imageUrl || !storyId) continue
        const record = await createSceneBackground(storyId, {
          name: bg.name.trim() || 'Background', image_url: imageUrl, session_id: sessionId,
        })
        bgDraftToDbId.set(bg.id, record.id)
      }

      if (wizardData.startingBackgroundId) {
        const dbId = bgDraftToDbId.get(wizardData.startingBackgroundId)
        if (dbId) await setSessionStartingBackground(sessionId, dbId)
      }

      // No start-choices handling — personalized mode has no start-choices
      // step (PERS_STEP_DEFS in types.ts) and inherits the template's as-is,
      // per explicit product decision.

      // TASK-008: scene_cover is NEVER regenerated here. Personalized story
      // edit is scoped to this player's own session, not the shared Scene
      // row that scene_cover lives on (and that PlayPanel/PublicStoriesPanel
      // cards display to every player) — buildSceneCoverUrl is intentionally
      // never called in this function.

      setToast({ type: 'success', message: 'Personalized edits saved.' })
      navigate(`/story/${storyId}`)
    } catch (err) {
      console.error('[SceneCreatorPage] submitPersonalized error:', err)
      setToast({ type: 'error', message: `Personalization not saved — ${err instanceof Error ? err.message : 'Something went wrong.'}` })
    }
  }, [storyId, wizardData, navigate, setToast, removedCharIds, removedBgIds, personalizedSessionId, personalizedCharSnapshots])

  const submitWizard = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setToast(null)
    try {
      if (!isEditMode) await submitCreate()
      else if (editMode === 'original') await submitEdit()
      else await submitPersonalized()
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, isEditMode, editMode, submitCreate, submitEdit, submitPersonalized, setIsSubmitting, setToast])

  return { submitWizard }
}
