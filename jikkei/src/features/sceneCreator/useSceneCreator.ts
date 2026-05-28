/**
 * useSceneCreator
 * All state, derived values, and handlers for SceneCreatorPage.
 * Submit logic lives separately in useSceneSubmit.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useEditModeGuide } from './useEditModeGuide'
import { ATTRIBUTE_PRESETS, type AttributePreset } from '../../data/Attributepresets'
import {
  getSceneForPlay,
  getSessionByScene,
  listStartChoicesForPlay,
  listPublicBackgrounds,
  listSessionBackgrounds,
  type PublicBackgroundRecord,
} from '../../services/backendApi'
import {
  TIER_LIMITS,
  PERSONALIZED_CHARACTER_LIMITS,
  MAX_START_CHOICES,
  MAX_ATTRIBUTES,
  ACCEPTED_IMAGE_TYPES,
  ORIG_STEP_DEFS,
  PERS_STEP_DEFS,
  type EditMode,
  type WizardData,
  type CharacterDraft,
  type BackgroundDraft,
  type ErrorMap,
} from './types'
import {
  makeId,
  buildBlankCharacter,
  buildInitialWizardData,
  hydrateWizardData,
  hydratePersonalizedWizardData,
} from './utils'

export function useSceneCreator() {
  const navigate = useNavigate()
  const { storyId } = useParams<{ storyId?: string }>()
  const isEditMode = !!storyId
  const { isPremium, userId, authResolved } = useAuth()
  const { showGuide: showEditModeGuide, closeGuide: closeEditModeGuide } = useEditModeGuide(isEditMode)

  const [isAuthor, setIsAuthor] = useState(false)
  const [editMode, setEditMode] = useState<EditMode>('original')
  const [isLoadingScene, setIsLoadingScene] = useState(isEditMode)
  const [loadError, setLoadError] = useState<string | null>(null)
  // The player's own session id, populated only when editMode becomes
  // 'personalized' — every Personalized-mode API call (create/update/delete
  // session character, list session backgrounds) needs this, not storyId.
  const [personalizedSessionId, setPersonalizedSessionId] = useState<string | null>(null)

  const removedCharIds = useRef<Set<string>>(new Set())
  const removedBgIds = useRef<Set<string>>(new Set())
  // Snapshot of each existing session character's fields AS LOADED, keyed by
  // SessionCharacter id. Lets submitPersonalized skip calling
  // updateSessionCharacter for characters the user never actually touched —
  // without this, every submit re-sent every template-derived character
  // (there's always at least one, since the cast clones at session start),
  // which is wasteful (re-embeds an unchanged lore chunk every time) and was
  // also the proximate cause of a "Session character not found" error when
  // a stale/mismatched existingId got submitted for a character that wasn't
  // actually being edited at all.
  const personalizedCharSnapshots = useRef<Map<string, {
    name: string; description: string; avatarUrl: string | null
    position: number; initialDialogue: string | null
  }>>(new Map())

  const [origStep, setOrigStep] = useState(1)
  const [persStep, setPersStep] = useState(1)
  const currentStep = editMode === 'personalized' ? persStep : origStep
  const setCurrentStep = editMode === 'personalized' ? setPersStep : setOrigStep
  const STEP_DEFS = editMode === 'personalized' ? PERS_STEP_DEFS : ORIG_STEP_DEFS

  const [activeCharIndex, setActiveCharIndex] = useState(0)
  const [wizardData, setWizardData] = useState<WizardData>(() => buildInitialWizardData())
  const [persData, setPersData] = useState<WizardData>(() => buildInitialWizardData())

  const data = editMode === 'personalized' ? persData : wizardData
  const setData = useCallback(
    (fn: (prev: WizardData) => WizardData) => {
      if (editMode === 'personalized') setPersData(fn)
      else setWizardData(fn)
    },
    [editMode],
  )

  const [stepErrors, setStepErrors] = useState<ErrorMap>({})
  const [showAttrModal, setShowAttrModal] = useState(false)
  const [attrModalSelection, setAttrModalSelection] = useState<Set<string>>(new Set())
  const [showAddExpressionModal, setShowAddExpressionModal] = useState(false)
  const [newExpressionName, setNewExpressionName] = useState('')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showPublicBgModal, setShowPublicBgModal] = useState(false)
  const [publicBackgrounds, setPublicBackgrounds] = useState<PublicBackgroundRecord[]>([])
  const [isLoadingPublicBgs, setIsLoadingPublicBgs] = useState(false)
  const [publicBgError, setPublicBgError] = useState<string | null>(null)
  const [publicBgPage, setPublicBgPage] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const expressionInputRef = useRef<HTMLInputElement | null>(null)
  const backgroundInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const objectUrlsRef = useRef<Set<string>>(new Set())
  const pageTopRef = useRef<HTMLDivElement | null>(null)

  // ── Load scene ────────────────────────────────────────────
  useEffect(() => {
    if (!storyId || !authResolved) return
    setIsLoadingScene(true)
    setLoadError(null)
    Promise.all([getSceneForPlay(storyId), listStartChoicesForPlay(storyId)])
      .then(async ([scene, choices]) => {
        const author = scene.user_id === userId
        setIsAuthor(author)

        // Fetch the session regardless of author status — an author who has
        // ALSO played their own story has a real SceneSession row too, and
        // switching to Personalized mode should use it. Only gating this
        // behind !author was the bug: it meant personalizedSessionId stayed
        // null forever for an author previewing/using Personalized mode on
        // their own story, even when they did have an active session.
        const personalizedSession = await getSessionByScene(storyId).catch(() => null)
        if (!author) {
          setEditMode('personalized')
          if (!personalizedSession) { setLoadError('You have never played this story.'); return }
        }
        if (personalizedSession) setPersonalizedSessionId(personalizedSession.id)

        const hydrated = hydrateWizardData(scene)
        hydrated.startChoices = choices.length > 0
          ? choices.map((c) => ({ id: c.id, existingId: c.id, choiceText: c.choice_text }))
          : [{ id: makeId(), existingId: null, choiceText: '' }]
        setWizardData(hydrated)

        if (personalizedSession) {
          // Personalized mode hydrates from the SESSION's own characters/
          // backgrounds, not the scene template — a returning player's prior
          // personalization must survive a page reload, which the old
          // "copy the template into persData" approach could never do since
          // it had no way to know about SessionCharacter rows at all.
          const sessionBackgrounds = await listSessionBackgrounds(personalizedSession.id).catch(() => scene.backgrounds)
          const hydratedPers = hydratePersonalizedWizardData(scene, personalizedSession, sessionBackgrounds)
          setPersData(hydratedPers)

          personalizedCharSnapshots.current.clear()
          for (const c of hydratedPers.characters) {
            if (!c.existingId) continue
            personalizedCharSnapshots.current.set(c.existingId, {
              name: c.name, description: c.description, avatarUrl: c.avatarUrl,
              position: hydratedPers.characters.indexOf(c), initialDialogue: c.initialDialogue || null,
            })
          }
        } else {
          // Author with NO session of their own yet: no SessionCharacter rows
          // exist, so falling back to the template view is reasonable. If
          // they later play their own story, reloading this page will pick
          // up the real session via the fetch above.
          setPersData({
            ...hydrated,
            characters: [...hydrated.characters],
            backgrounds: [...hydrated.backgrounds],
            startChoices: [],
          })
        }
      })
      .catch((err) => {
        const status = (err as { status?: number }).status
        setLoadError(
          status === 403 || status === 401
            ? 'You are not authorised to edit this story.'
            : err instanceof Error ? err.message : 'Failed to load scene.',
        )
      })
      .finally(() => setIsLoadingScene(false))
  }, [storyId, authResolved, userId])

  // ── Object URL cleanup ────────────────────────────────────
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      objectUrlsRef.current.clear()
    }
  }, [])

  // ── Toast auto-dismiss ────────────────────────────────────
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

  // ── URL helpers ───────────────────────────────────────────
  const registerUrl = useCallback((url: string) => { objectUrlsRef.current.add(url); return url }, [])
  const releaseUrl = useCallback((url: string | null) => {
    if (!url || !url.startsWith('blob:')) return
    if (objectUrlsRef.current.has(url)) { URL.revokeObjectURL(url); objectUrlsRef.current.delete(url) }
  }, [])

  // ── Derived ───────────────────────────────────────────────
  const activeChar = data.characters[activeCharIndex]
  const tierLimits = TIER_LIMITS[data.tier]
  const sessionOnlyChars = data.characters.filter((c) => !c.isOriginal)
  // Personalized mode uses its own tier cap (PERSONALIZED_CHARACTER_LIMITS,
  // keyed by the PLAYER's subscription tier) — NOT tierLimits.characters,
  // which governs the scene AUTHOR's Original-mode character count and is a
  // different number entirely (e.g. premium: 3 there vs 4 here). Mixing
  // these up would let the UI silently disagree with what the backend's
  // check_session_character_limit actually enforces.
  const personalizedCharacterLimit = isPremium ? PERSONALIZED_CHARACTER_LIMITS.premium : PERSONALIZED_CHARACTER_LIMITS.free
  const canAddCharacter = editMode === 'personalized'
    ? sessionOnlyChars.length < personalizedCharacterLimit
    : data.characters.length < tierLimits.characters
  const canAddBackground = data.backgrounds.filter((b) => !b.isOriginal).length < tierLimits.backgrounds
  const canAddStartChoice = data.startChoices.length < MAX_START_CHOICES

  // ── Scene-level field setter ──────────────────────────────
  const setSceneField = useCallback(<K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }))
  }, [setData])

  // ── Character handlers ────────────────────────────────────
  const updateCharacter = useCallback((charId: string, patch: Partial<CharacterDraft>) => {
    setData((prev) => ({
      ...prev,
      characters: prev.characters.map((c) => c.id === charId ? { ...c, ...patch } : c),
    }))
  }, [setData])

  const addCharacter = useCallback(() => {
    if (!canAddCharacter) return
    const newChar = buildBlankCharacter(false)
    setData((prev) => ({ ...prev, characters: [...prev.characters, newChar] }))
    setActiveCharIndex(data.characters.length)
  }, [canAddCharacter, data.characters.length, setData])

  const removeCharacter = useCallback((charId: string) => {
    setData((prev) => {
      const idx = prev.characters.findIndex((c) => c.id === charId)
      if (idx === -1) return prev
      const char = prev.characters[idx]
      // Personalized mode: template-derived characters (isOriginal: true) can
      // NEVER be removed — matches the backend's delete_session_character,
      // which 403s on is_session_only=false. Guarding here too so the UI
      // doesn't even let the user try (rather than letting them remove it
      // from the draft only to have submitPersonalized silently skip it).
      if (editMode === 'personalized' && char.isOriginal) return prev
      if (char.existingId) removedCharIds.current.add(char.existingId)
      releaseUrl(char.avatarPreview)
      char.expressions.forEach((e) => releaseUrl(e.preview))
      const next = prev.characters.filter((c) => c.id !== charId)
      return { ...prev, characters: next.length > 0 ? next : [buildBlankCharacter()] }
    })
    setActiveCharIndex((prev) => Math.max(0, prev - 1))
  }, [releaseUrl, editMode, setData])

  // ── Avatar handlers ───────────────────────────────────────
  const handleAvatarFile = useCallback((file: File | null) => {
    if (!file || !activeChar) return
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) { setToast({ type: 'error', message: 'Only JPG, PNG, and WEBP are allowed.' }); return }
    const url = registerUrl(URL.createObjectURL(file))
    releaseUrl(activeChar.avatarPreview)
    updateCharacter(activeChar.id, { avatarPreview: url, avatarFile: file, avatarUrl: null })
  }, [activeChar, registerUrl, releaseUrl, updateCharacter])

  const handleAvatarInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => { handleAvatarFile(e.target.files?.[0] ?? null); e.target.value = '' },
    [handleAvatarFile],
  )
  const handleAvatarDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); handleAvatarFile(e.dataTransfer.files?.[0] ?? null) },
    [handleAvatarFile],
  )

  // ── Generate modal ────────────────────────────────────────
  const handleConfirmGenerate = useCallback(() => {
    if (!activeChar || isGenerating || !generatePrompt.trim()) return
    setIsGenerating(true)
    window.setTimeout(() => {
      setIsGenerating(false); setShowGenerateModal(false); setGeneratePrompt('')
      updateCharacter(activeChar.id, { isGenerated: true })
      setToast({ type: 'success', message: 'Successfully generated.' })
    }, 900)
  }, [activeChar, isGenerating, generatePrompt, updateCharacter])

  // ── Expression handlers ───────────────────────────────────
  const setActiveExpressionSlot = useCallback((slotKey: string) => {
    if (!activeChar) return
    updateCharacter(activeChar.id, { activeExpressionSlot: slotKey })
  }, [activeChar, updateCharacter])

  const addExpressionTab = useCallback(() => {
    const name = newExpressionName.trim()
    if (!name || !activeChar) return
    const slotKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || makeId()
    // neutral and default are reserved: every character already gets an
    // implicit neutral expression for free, wired directly to avatar_url
    // in-game (see expressionImage() in storyPresentation.ts) rather than to
    // any row a creator could author here. Letting someone name a custom
    // expression Neutral would upload a real image that the game would
    // then silently never display, the same dead-data trap this whole fix
    // was meant to close.
    if (slotKey === 'neutral' || slotKey === 'default') {
      setToast({ type: 'error', message: 'Neutral is reserved: every character already has one, based on their avatar image.' }); return
    }
    if (activeChar.expressions.some((e) => e.slotKey === slotKey)) {
      setToast({ type: 'error', message: 'An expression with that name already exists.' }); return
    }
    updateCharacter(activeChar.id, {
      expressions: [...activeChar.expressions, { slotKey, displayName: name, imageUrl: null, preview: null, file: null }],
      activeExpressionSlot: slotKey,
    })
    setNewExpressionName(''); setShowAddExpressionModal(false)
  }, [activeChar, newExpressionName, updateCharacter])

  const removeExpressionTab = useCallback((slotKey: string) => {
    if (!activeChar) return
    const target = activeChar.expressions.find((e) => e.slotKey === slotKey)
    if (target) releaseUrl(target.preview)
    const next = activeChar.expressions.filter((e) => e.slotKey !== slotKey)
    updateCharacter(activeChar.id, {
      expressions: next,
      activeExpressionSlot: activeChar.activeExpressionSlot === slotKey ? (next[0]?.slotKey ?? '') : activeChar.activeExpressionSlot,
    })
  }, [activeChar, releaseUrl, updateCharacter])

  const activeExpressionTab = useMemo(
    () => activeChar?.expressions.find((e) => e.slotKey === activeChar.activeExpressionSlot) ?? null,
    [activeChar],
  )

  const handleExpressionFile = useCallback((file: File | null) => {
    if (!file || !activeChar || !activeExpressionTab) return
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) { setToast({ type: 'error', message: 'Only JPG, PNG, and WEBP are allowed.' }); return }
    const url = registerUrl(URL.createObjectURL(file))
    releaseUrl(activeExpressionTab.preview)
    updateCharacter(activeChar.id, {
      expressions: activeChar.expressions.map((e) =>
        e.slotKey === activeExpressionTab.slotKey ? { ...e, preview: url, file, imageUrl: null } : e,
      ),
    })
  }, [activeChar, activeExpressionTab, registerUrl, releaseUrl, updateCharacter])

  const handleExpressionInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => { handleExpressionFile(e.target.files?.[0] ?? null); e.target.value = '' },
    [handleExpressionFile],
  )
  const handleExpressionDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); handleExpressionFile(e.dataTransfer.files?.[0] ?? null) },
    [handleExpressionFile],
  )

  // ── Attribute modal ───────────────────────────────────────
  const openAttrModal = useCallback(() => {
    if (!activeChar) return
    setAttrModalSelection(new Set(activeChar.attributes.map((a) => a.attrKey)))
    setShowAttrModal(true)
  }, [activeChar])

  const toggleAttrInModal = useCallback((key: string) => {
    setAttrModalSelection((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { if (next.size >= MAX_ATTRIBUTES) return prev; next.add(key) }
      return next
    })
  }, [])

  const confirmAttrModal = useCallback(() => {
    if (!activeChar) return
    const existingByKey = new Map(activeChar.attributes.map((a) => [a.attrKey, a]))
    const nextAttributes = Array.from(attrModalSelection).slice(0, MAX_ATTRIBUTES).map((key) => {
      const existing = existingByKey.get(key)
      if (existing) return existing
      const preset = ATTRIBUTE_PRESETS.find((p) => p.key === key) as AttributePreset
      return { attrKey: preset.key, initialValue: preset.initial, minValue: preset.min, maxValue: preset.max }
    })
    updateCharacter(activeChar.id, { attributes: nextAttributes })
    setShowAttrModal(false)
  }, [activeChar, attrModalSelection, updateCharacter])

  const updateAttributeValue = useCallback((attrKey: string, value: number) => {
    if (!activeChar) return
    updateCharacter(activeChar.id, {
      attributes: activeChar.attributes.map((a) => a.attrKey === attrKey ? { ...a, initialValue: value } : a),
    })
  }, [activeChar, updateCharacter])

  const removeAttribute = useCallback((attrKey: string) => {
    if (!activeChar) return
    updateCharacter(activeChar.id, { attributes: activeChar.attributes.filter((a) => a.attrKey !== attrKey) })
  }, [activeChar, updateCharacter])

  // ── Background handlers ───────────────────────────────────
  const addBackground = useCallback(() => {
    if (!canAddBackground) return
    const id = makeId()
    setData((prev) => ({
      ...prev,
      backgrounds: [...prev.backgrounds, { id, existingId: null, isOriginal: false, name: `Background ${prev.backgrounds.length + 1}`, imageUrl: null, preview: null, file: null }],
      startingBackgroundId: prev.startingBackgroundId ?? id,
    }))
  }, [canAddBackground, setData])

  const removeBackground = useCallback((bgId: string) => {
    setData((prev) => {
      const bg = prev.backgrounds.find((b) => b.id === bgId)
      if (!bg) return prev
      // Personalized mode: template backgrounds (isOriginal: true) can't be
      // removed — there's no "hide this template background for my session
      // only" concept in the schema, only "this session owns its own extra
      // background". Mirrors the same guard on removeCharacter above.
      if (editMode === 'personalized' && bg.isOriginal) return prev
      // Never let a session drop to zero backgrounds — mirrors the backend's
      // delete_session_background invariant (403 if this would be the last
      // one). Checked here too so the user gets immediate feedback (the
      // remove control simply does nothing / can be disabled) instead of
      // discovering it only as a submit-time error.
      if (editMode === 'personalized' && prev.backgrounds.length <= 1) return prev
      releaseUrl(bg.preview)
      if (bg.existingId) removedBgIds.current.add(bg.existingId)
      const next = prev.backgrounds.filter((b) => b.id !== bgId)
      return {
        ...prev,
        backgrounds: next,
        startingBackgroundId: prev.startingBackgroundId === bgId ? (next[0]?.id ?? null) : prev.startingBackgroundId,
      }
    })
  }, [releaseUrl, editMode, setData])

  const updateBackgroundField = useCallback(<K extends keyof BackgroundDraft>(bgId: string, key: K, value: BackgroundDraft[K]) => {
    setData((prev) => ({
      ...prev,
      backgrounds: prev.backgrounds.map((b) => b.id === bgId ? { ...b, [key]: value } : b),
    }))
  }, [setData])

  const handleBackgroundFile = useCallback((bgId: string, file: File | null) => {
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) { setToast({ type: 'error', message: 'Only JPG, PNG, and WEBP are allowed.' }); return }
    const url = registerUrl(URL.createObjectURL(file))
    setData((prev) => ({
      ...prev,
      backgrounds: prev.backgrounds.map((b) => {
        if (b.id !== bgId) return b
        releaseUrl(b.preview)
        return { ...b, preview: url, file, imageUrl: null }
      }),
    }))
  }, [registerUrl, releaseUrl, setData])

  // ── Public bg modal ───────────────────────────────────────
  const openPublicBgModal = useCallback(() => {
    setShowPublicBgModal(true)
    if (publicBackgrounds.length > 0 || isLoadingPublicBgs) return
    setIsLoadingPublicBgs(true); setPublicBgError(null)
    listPublicBackgrounds()
      .then(setPublicBackgrounds)
      .catch((err) => setPublicBgError(err instanceof Error ? err.message : 'Failed.'))
      .finally(() => setIsLoadingPublicBgs(false))
  }, [publicBackgrounds.length, isLoadingPublicBgs])

  const pickPublicBackground = useCallback((pub: PublicBackgroundRecord) => {
    if (!canAddBackground) return
    // Don't add the same public background twice — the modal already grays
    // out picked ones, but guard here too in case of a stale double-click
    // or any other path that bypasses the disabled button.
    if (data.backgrounds.some((b) => b.imageUrl === pub.image_url)) return
    const id = makeId()
    setData((prev) => ({
      ...prev,
      backgrounds: [...prev.backgrounds, { id, existingId: null, isOriginal: false, name: pub.name, imageUrl: pub.image_url, preview: null, file: null }],
      startingBackgroundId: prev.startingBackgroundId ?? id,
    }))
    setShowPublicBgModal(false)
  }, [canAddBackground, data.backgrounds, setData])

  // Image URLs already present in this story's background list — used by
  // PublicBgPickerModal to gray out backgrounds that have already been
  // picked, so the same one can't be added twice.
  const pickedPublicBgUrls = useMemo(
    () => new Set(data.backgrounds.map((b) => b.imageUrl).filter((url): url is string => !!url)),
    [data.backgrounds],
  )

  const PUBLIC_BG_PAGE_SIZE = 9
  const publicBgTotalPages = Math.max(1, Math.ceil(publicBackgrounds.length / PUBLIC_BG_PAGE_SIZE))
  const publicBgPageItems = useMemo(
    () => publicBackgrounds.slice(publicBgPage * PUBLIC_BG_PAGE_SIZE, (publicBgPage + 1) * PUBLIC_BG_PAGE_SIZE),
    [publicBackgrounds, publicBgPage],
  )

  // ── Start choice handlers ─────────────────────────────────
  const addStartChoice = useCallback(() => {
    if (!canAddStartChoice) return
    setData((prev) => ({ ...prev, startChoices: [...prev.startChoices, { id: makeId(), existingId: null, choiceText: '' }] }))
  }, [canAddStartChoice, setData])

  const updateStartChoice = useCallback((choiceId: string, text: string) => {
    setData((prev) => ({ ...prev, startChoices: prev.startChoices.map((c) => c.id === choiceId ? { ...c, choiceText: text } : c) }))
  }, [setData])

  const removeStartChoice = useCallback((choiceId: string) => {
    setData((prev) => ({ ...prev, startChoices: prev.startChoices.filter((c) => c.id !== choiceId) }))
  }, [setData])

  // ── Validation ────────────────────────────────────────────
  const validateStep = useCallback((step: number): ErrorMap => {
    const errors: ErrorMap = {}
    if (editMode === 'original') {
      if (step === 1) {
        if (!data.title.trim()) errors.title = 'Story title is required.'
        if (!data.description.trim()) errors.description = 'Story description is required.'
      }
      if (step === 2) {
        data.characters.forEach((c, i) => {
          if (!c.name.trim()) errors[`char-name-${i}`] = 'Character name is required.'
          if (!c.description.trim()) errors[`char-desc-${i}`] = 'Character description is required.'
          if (!c.avatarFile && !c.avatarUrl) errors[`char-avatar-${i}`] = 'Character image is required.'
          if (c.attributes.length === 0) errors[`char-attrs-${i}`] = 'Select at least 1 attribute.'
        })
      }
      if (step === 3 && data.backgrounds.length === 0) errors.backgrounds = 'Add at least one background.'
      if (step === 4 && data.startChoices.filter((c) => c.choiceText.trim()).length === 0) errors.choices = 'Add at least one starting choice.'
    }
    if (editMode === 'personalized') {
      if (step === 1) {
        data.characters.filter((c) => !c.isOriginal).forEach((c, i) => {
          if (!c.name.trim()) errors[`char-name-new-${i}`] = 'Character name is required.'
          if (!c.description.trim()) errors[`char-desc-new-${i}`] = 'Character description is required.'
          if (!c.avatarFile && !c.avatarUrl) errors[`char-avatar-new-${i}`] = 'Character image is required.'
          if (c.attributes.length === 0) errors[`char-attrs-new-${i}`] = 'Select at least 1 attribute.'
        })
      }
      // Personalized mode has no start-choices step (PERS_STEP_DEFS: characters
      // → backgrounds → review). startingBg validation lives on the backgrounds
      // step (step 2) accordingly — it used to be step 2 of a 4-step flow that
      // also had a separate choices step 3, which has been removed entirely
      // per product decision (personalized mode inherits the template's start
      // choices as-is, players don't customize them).
      if (step === 2 && !data.startingBackgroundId) errors.startingBg = 'Select a starting background.'
    }
    return errors
  }, [data, editMode])

  const goNext = useCallback(() => {
    const errors = validateStep(currentStep)
    setStepErrors(errors)
    if (Object.keys(errors).length > 0) { pageTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
    setCurrentStep((s) => Math.min(STEP_DEFS.length, s + 1))
  }, [currentStep, validateStep, STEP_DEFS.length, setCurrentStep])

  const goPrevious = useCallback(() => { setCurrentStep((s) => Math.max(1, s - 1)); setStepErrors({}) }, [setCurrentStep])

  const handleBack = useCallback(() => { navigate('/play') }, [navigate])

  return {
    // routing / auth
    storyId,
    isEditMode,
    navigate,
    isPremium,
    isAuthor,
    editMode,
    setEditMode,

    // edit mode guide modal
    showEditModeGuide,
    closeEditModeGuide,

    // loading states
    isLoadingScene,
    authResolved,
    loadError,
    personalizedSessionId,

    // wizard state
    data,
    wizardData,
    setWizardData,
    persData,
    setPersData,
    origStep,
    persStep,
    currentStep,
    STEP_DEFS,
    stepErrors,
    setStepErrors,
    isSubmitting,
    setIsSubmitting,
    toast,
    setToast,

    // character
    activeChar,
    activeCharIndex,
    setActiveCharIndex,
    canAddCharacter,
    activeExpressionTab,
    setSceneField,
    updateCharacter,
    addCharacter,
    removeCharacter,
    handleAvatarFile,
    handleAvatarInputChange,
    handleAvatarDrop,
    handleConfirmGenerate,
    setActiveExpressionSlot,
    addExpressionTab,
    removeExpressionTab,
    handleExpressionFile,
    handleExpressionInputChange,
    handleExpressionDrop,

    // attributes
    openAttrModal,
    toggleAttrInModal,
    confirmAttrModal,
    updateAttributeValue,
    removeAttribute,
    showAttrModal,
    setShowAttrModal,
    attrModalSelection,

    // expression modal
    showAddExpressionModal,
    setShowAddExpressionModal,
    newExpressionName,
    setNewExpressionName,

    // generate modal
    showGenerateModal,
    setShowGenerateModal,
    generatePrompt,
    setGeneratePrompt,
    isGenerating,

    // backgrounds
    tierLimits,
    canAddBackground,
    addBackground,
    removeBackground,
    updateBackgroundField,
    handleBackgroundFile,
    backgroundInputRefs,

    // public bg modal
    showPublicBgModal,
    setShowPublicBgModal,
    publicBackgrounds,
    isLoadingPublicBgs,
    publicBgError,
    publicBgPage,
    setPublicBgPage,
    publicBgTotalPages,
    publicBgPageItems,
    openPublicBgModal,
    pickPublicBackground,
    pickedPublicBgUrls,

    // start choices
    canAddStartChoice,
    addStartChoice,
    updateStartChoice,
    removeStartChoice,

    // navigation
    goNext,
    goPrevious,
    handleBack,

    // refs
    avatarInputRef,
    expressionInputRef,
    pageTopRef,

    // removed id trackers (needed by submit)
    removedCharIds,
    removedBgIds,
    personalizedCharSnapshots,
  }
}

export type SceneCreatorContext = ReturnType<typeof useSceneCreator>
