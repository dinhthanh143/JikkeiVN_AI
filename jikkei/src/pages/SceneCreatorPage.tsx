import { AppLoadingScreen } from '../components/ui/AppLoadingScreen'
import { useSceneCreator } from '../features/sceneCreator/useSceneCreator'
import { useSceneSubmit } from '../features/sceneCreator/useSceneSubmit'
import { StepBasics } from '../features/sceneCreator/steps/StepBasics'
import { StepCharacters } from '../features/sceneCreator/steps/StepCharacters'
import { StepBackgrounds } from '../features/sceneCreator/steps/StepBackgrounds'
import { StepChoices } from '../features/sceneCreator/steps/StepChoices'
import { StepReview } from '../features/sceneCreator/steps/StepReview'
import { AttrPickerModal } from '../features/sceneCreator/modals/AttrPickerModal'
import { AddExpressionModal } from '../features/sceneCreator/modals/AddExpressionModal'
import { PublicBgPickerModal } from '../features/sceneCreator/modals/PublicBgPickerModal'
import { GenerateArtModal } from '../features/sceneCreator/modals/GenerateArtModal'
import { EditModeGuideModal } from '../features/sceneCreator/modals/EditModeGuideModal'
import '../styles/SceneCreatorPage.css'

export default function SceneCreatorPage() {
  const ctx = useSceneCreator()

  // navigate is already called inside useSceneCreator — re-use it here
  const { submitWizard } = useSceneSubmit({
    storyId: ctx.storyId,
    isEditMode: ctx.isEditMode,
    editMode: ctx.editMode,
    // ctx.data, NOT ctx.wizardData — ctx.data is the mode-aware derived value
    // (persData in personalized mode, wizardData in original mode). Passing
    // ctx.wizardData unconditionally was THE root cause of "Session character
    // not found": submitPersonalized read template Character ids out of
    // wizardData (always original-mode data) and submitted them against
    // SessionCharacter lookups, which can never match. It also silently hid
    // every personalized background addition/removal from submitPersonalized,
    // since those only ever landed in persData. See TasksAndProgress.md.
    wizardData: ctx.data,
    navigate: ctx.navigate,
    isSubmitting: ctx.isSubmitting,
    setIsSubmitting: ctx.setIsSubmitting,
    setToast: ctx.setToast,
    removedCharIds: ctx.removedCharIds,
    removedBgIds: ctx.removedBgIds,
    personalizedSessionId: ctx.personalizedSessionId,
    personalizedCharSnapshots: ctx.personalizedCharSnapshots,
  })

  // ── Loading / error gates ──────────────────────────────────
  // Uses the SAME fullscreen AppLoadingScreen as the router's Suspense
  // fallback (the one shown first, while the SceneCreatorPage chunk loads)
  // instead of a second, page-local loading screen. Previously this branch
  // rendered a different component (PageLoadingScreen) which was NOT
  // position:fixed, so when it mounted inside HomePage's padded
  // `.panel-scroll` container it appeared boxed in with blank space around
  // it — and visually read as a second, different loader popping in right
  // after the first. Reusing AppLoadingScreen here removes both problems:
  // one consistent fullscreen loader for the whole Play → Edit transition.
  if (ctx.isEditMode && (!ctx.authResolved || ctx.isLoadingScene)) {
    return <AppLoadingScreen kicker="JIKKEI" copy="Loading Story..." />
  }

  if (ctx.loadError) {
    return (
      <div className="sc-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: '60vh' }}>
        <p className="sc-error">{ctx.loadError}</p>
        <button type="button" className="sc-btn-ghost" onClick={ctx.handleBack}>← Back</button>
      </div>
    )
  }

  // ── Step routing ───────────────────────────────────────────
  const renderBasicsStep = () => (
    <StepBasics
      data={ctx.data}
      isEditMode={ctx.isEditMode}
      isPremium={ctx.isPremium}
      stepErrors={ctx.stepErrors}
      setSceneField={ctx.setSceneField}
    />
  )

  const renderCharactersStep = (persMode: boolean) => (
    <StepCharacters
      persMode={persMode}
      data={ctx.data}
      activeCharIndex={ctx.activeCharIndex}
      setActiveCharIndex={ctx.setActiveCharIndex}
      activeChar={ctx.activeChar}
      activeExpressionTab={ctx.activeExpressionTab}
      canAddCharacter={ctx.canAddCharacter}
      stepErrors={ctx.stepErrors}
      updateCharacter={ctx.updateCharacter}
      addCharacter={ctx.addCharacter}
      removeCharacter={ctx.removeCharacter}
      avatarInputRef={ctx.avatarInputRef}
      handleAvatarInputChange={ctx.handleAvatarInputChange}
      handleAvatarDrop={ctx.handleAvatarDrop}
      onOpenGenerateModal={() => ctx.setShowGenerateModal(true)}
      expressionInputRef={ctx.expressionInputRef}
      handleExpressionInputChange={ctx.handleExpressionInputChange}
      handleExpressionDrop={ctx.handleExpressionDrop}
      setActiveExpressionSlot={ctx.setActiveExpressionSlot}
      removeExpressionTab={ctx.removeExpressionTab}
      onOpenAddExpressionModal={() => ctx.setShowAddExpressionModal(true)}
      openAttrModal={ctx.openAttrModal}
      updateAttributeValue={ctx.updateAttributeValue}
      removeAttribute={ctx.removeAttribute}
    />
  )

  const renderBackgroundsStep = (persMode: boolean) => (
    <StepBackgrounds
      persMode={persMode}
      data={ctx.data}
      tierLimits={ctx.tierLimits}
      canAddBackground={ctx.canAddBackground}
      stepErrors={ctx.stepErrors}
      setSceneField={ctx.setSceneField}
      addBackground={ctx.addBackground}
      removeBackground={ctx.removeBackground}
      updateBackgroundField={ctx.updateBackgroundField}
      handleBackgroundFile={ctx.handleBackgroundFile}
      backgroundInputRefs={ctx.backgroundInputRefs}
      openPublicBgModal={ctx.openPublicBgModal}
    />
  )

  const renderChoicesStep = () => (
    <StepChoices
      data={ctx.data}
      canAddStartChoice={ctx.canAddStartChoice}
      stepErrors={ctx.stepErrors}
      addStartChoice={ctx.addStartChoice}
      updateStartChoice={ctx.updateStartChoice}
      removeStartChoice={ctx.removeStartChoice}
    />
  )

  const renderReviewStep = (persMode: boolean) => (
    <StepReview
      persMode={persMode}
      isEditMode={ctx.isEditMode}
      data={ctx.data}
      isSubmitting={ctx.isSubmitting}
      onSubmit={() => void submitWizard()}
    />
  )

  const renderCurrentStep = () => {
    if (ctx.editMode === 'personalized') {
      // PERS_STEP_DEFS: characters → backgrounds → review (no choices step —
      // personalized mode inherits the template's start choices as-is).
      if (ctx.persStep === 1) return renderCharactersStep(true)
      if (ctx.persStep === 2) return renderBackgroundsStep(true)
      if (ctx.persStep === 3) return renderReviewStep(true)
    } else {
      if (ctx.origStep === 1) return renderBasicsStep()
      if (ctx.origStep === 2) return renderCharactersStep(false)
      if (ctx.origStep === 3) return renderBackgroundsStep(false)
      if (ctx.origStep === 4) return renderChoicesStep()
      if (ctx.origStep === 5) return renderReviewStep(false)
    }
    return null
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="sc-page" ref={ctx.pageTopRef}>
      <header className="sc-header">
        <div className="sc-header-top-row">
          <button type="button" className="sc-back-btn" onClick={ctx.handleBack}>← Back</button>

          {ctx.isEditMode ? (
            <div className="sc-edit-mode-seg" role="group" aria-label="Edit mode">
              <button
                type="button"
                className={`sc-edit-mode-seg-btn ${ctx.editMode === 'original' ? 'sc-edit-mode-seg-btn-active' : ''} ${!ctx.isAuthor ? 'sc-edit-mode-seg-btn-disabled' : ''}`}
                onClick={() => ctx.isAuthor && ctx.setEditMode('original')}
                disabled={!ctx.isAuthor}
                title={!ctx.isAuthor ? 'Only the story author can use original edit' : undefined}
              >
                Original story edit
              </button>
              <button
                type="button"
                className={`sc-edit-mode-seg-btn ${ctx.editMode === 'personalized' ? 'sc-edit-mode-seg-btn-active' : ''}`}
                onClick={() => ctx.setEditMode('personalized')}
              >
                Personalized story edit
              </button>
            </div>
          ) : null}
        </div>

        <div className="sc-header-top">
          <span className="sc-eyebrow">
            {!ctx.isEditMode ? 'CREATE STORY' : ctx.editMode === 'original' ? 'EDIT STORY' : 'PERSONALIZED EDIT'}
          </span>
          <span className="sc-step-name">{ctx.STEP_DEFS[ctx.currentStep - 1].label}</span>
        </div>

        <div className="sc-progress-track">
          {ctx.STEP_DEFS.map((step, i) => (
            <div key={step.key} className="sc-progress-seg">
              <div className="sc-progress-seg-fill" style={{ transform: `scaleX(${i + 1 <= ctx.currentStep ? 1 : 0})` }} />
            </div>
          ))}
        </div>

        <div className="sc-progress-labels">
          {ctx.STEP_DEFS.map((step, i) => (
            <span key={step.key} className={i + 1 === ctx.currentStep ? 'sc-label-active' : ''}>{step.label}</span>
          ))}
        </div>
      </header>

      <section>{renderCurrentStep()}</section>

      <nav className="sc-nav-row">
        <button type="button" className="sc-btn-ghost" onClick={ctx.goPrevious} disabled={ctx.currentStep === 1 || ctx.isSubmitting}>
          Previous
        </button>
        {ctx.currentStep < ctx.STEP_DEFS.length
          ? <button type="button" className="sc-btn-primary" onClick={ctx.goNext} disabled={ctx.isSubmitting}>Next</button>
          : <span />}
      </nav>

      {/* ── Modals ── */}
      {ctx.showEditModeGuide && (
        <EditModeGuideModal onClose={ctx.closeEditModeGuide} />
      )}

      {ctx.showAttrModal && (
        <AttrPickerModal
          selection={ctx.attrModalSelection}
          onToggle={ctx.toggleAttrInModal}
          onConfirm={ctx.confirmAttrModal}
          onClose={() => ctx.setShowAttrModal(false)}
        />
      )}

      {ctx.showAddExpressionModal && (
        <AddExpressionModal
          value={ctx.newExpressionName}
          onChange={ctx.setNewExpressionName}
          onConfirm={ctx.addExpressionTab}
          onClose={() => { ctx.setShowAddExpressionModal(false); ctx.setNewExpressionName('') }}
        />
      )}

      {ctx.showPublicBgModal && (
        <PublicBgPickerModal
          isLoading={ctx.isLoadingPublicBgs}
          error={ctx.publicBgError}
          backgrounds={ctx.publicBackgrounds}
          pageItems={ctx.publicBgPageItems}
          page={ctx.publicBgPage}
          totalPages={ctx.publicBgTotalPages}
          pickedImageUrls={ctx.pickedPublicBgUrls}
          onPageChange={ctx.setPublicBgPage}
          onPick={ctx.pickPublicBackground}
          onClose={() => ctx.setShowPublicBgModal(false)}
        />
      )}

      {ctx.showGenerateModal && (
        <GenerateArtModal
          prompt={ctx.generatePrompt}
          isGenerating={ctx.isGenerating}
          onChange={ctx.setGeneratePrompt}
          onConfirm={ctx.handleConfirmGenerate}
          onClose={() => { ctx.setShowGenerateModal(false); ctx.setGeneratePrompt('') }}
        />
      )}

      {ctx.toast && (
        <div className={`sc-toast sc-toast-${ctx.toast.type}`} role="status" aria-live="polite">
          {ctx.toast.message}
        </div>
      )}
    </div>
  )
}
