import type { ChangeEvent, MutableRefObject } from 'react'
import type { WizardData, BackgroundDraft, ErrorMap } from '../types'

interface Props {
  persMode: boolean
  data: WizardData
  tierLimits: { backgrounds: number }
  canAddBackground: boolean
  stepErrors: ErrorMap
  setSceneField: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void
  addBackground: () => void
  removeBackground: (id: string) => void
  updateBackgroundField: <K extends keyof BackgroundDraft>(id: string, key: K, value: BackgroundDraft[K]) => void
  handleBackgroundFile: (bgId: string, file: File | null) => void
  backgroundInputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>
  openPublicBgModal: () => void
}

export function StepBackgrounds({
  persMode,
  data,
  tierLimits,
  canAddBackground,
  stepErrors,
  setSceneField,
  addBackground,
  removeBackground,
  updateBackgroundField,
  handleBackgroundFile,
  backgroundInputRefs,
  openPublicBgModal,
}: Props) {

  const renderBgCard = (bg: BackgroundDraft, allowRemove: boolean) => (
    <div key={bg.id} className="sc-card">
      <div className="sc-bg-head">
        <span className="sc-bg-head-label">{bg.name || 'Background'}</span>
        {allowRemove && (
          <button type="button" className="sc-icon-btn" onClick={() => removeBackground(bg.id)}>×</button>
        )}
      </div>
      <div className="sc-bg-body">
        <input
          ref={(node) => { backgroundInputRefs.current[bg.id] = node }}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          onChange={(e: ChangeEvent<HTMLInputElement>) => { handleBackgroundFile(bg.id, e.target.files?.[0] ?? null); e.target.value = '' }}
        />
        <div
          className="sc-dropzone sc-bg-dropzone"
          role="button"
          tabIndex={0}
          onClick={() => backgroundInputRefs.current[bg.id]?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleBackgroundFile(bg.id, e.dataTransfer.files?.[0] ?? null) }}
        >
          {bg.preview || bg.imageUrl
            ? <img src={bg.preview || bg.imageUrl || ''} alt={bg.name} className="sc-dropzone-img" />
            : <><strong>Drop image or click</strong><span>JPG, PNG, WEBP · max 5MB</span></>}
        </div>
        <label className="sc-field" style={{ marginTop: 8 }}>
          <span className="sc-field-label">Name</span>
          <input
            className="sc-input"
            type="text"
            maxLength={80}
            value={bg.name}
            onChange={(e) => updateBackgroundField(bg.id, 'name', e.target.value)}
          />
        </label>
      </div>
      <div className="sc-bg-footer">
        <label className="sc-bg-radio-label">
          <input
            type="radio"
            name="startingBackground"
            checked={data.startingBackgroundId === bg.id}
            onChange={() => setSceneField('startingBackgroundId', bg.id)}
          />
          Set as starting background
        </label>
        {!persMode && <small>Loads when the scene begins</small>}
      </div>
    </div>
  )

  if (persMode) {
    const sessionBgs = data.backgrounds.filter((b) => !b.isOriginal)
    return (
      <div className="sc-step-body">
        <div className="sc-section-label"><span className="sc-dot" /><span className="sc-section-title">Backgrounds</span></div>
        <p className="sc-section-hint">Select a starting background from the original set, or add new session-only backgrounds.</p>
        {stepErrors.startingBg ? <p className="sc-error">{stepErrors.startingBg}</p> : null}

        <div className="sc-pers-bg-grid">
          {data.backgrounds.filter((b) => b.isOriginal).map((bg) => (
            <button
              key={bg.id}
              type="button"
              className={`sc-pers-bg-card ${data.startingBackgroundId === bg.id ? 'sc-pers-bg-card-active' : ''}`}
              onClick={() => setSceneField('startingBackgroundId', bg.id)}
            >
              {bg.imageUrl ? <img src={bg.imageUrl} alt={bg.name} /> : <div className="sc-pers-bg-placeholder">No image</div>}
              <span className="sc-pers-bg-name">{bg.name}</span>
              {data.startingBackgroundId === bg.id && <span className="sc-pers-bg-check">✓ Starting</span>}
            </button>
          ))}
        </div>

        {sessionBgs.length > 0 && (
          <>
            <p className="sc-section-hint" style={{ marginTop: 16 }}>Your added backgrounds:</p>
            <div className="sc-bg-stack">
              {sessionBgs.map((bg) => renderBgCard(bg, true))}
            </div>
          </>
        )}

        <div className="sc-bg-actions-row" style={{ marginTop: 12 }}>
          <button type="button" className="sc-btn-ghost" disabled={!canAddBackground} onClick={addBackground}>
            {canAddBackground ? '+ Add background' : 'Maximum reached'}
          </button>
          <button type="button" className="sc-btn-ghost" disabled={!canAddBackground} onClick={openPublicBgModal}>
            Choose a public background
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="sc-step-body">
      <div className="sc-section-label"><span className="sc-dot" /><span className="sc-section-title">Backgrounds</span></div>
      <p className="sc-section-hint">Up to {tierLimits.backgrounds} backgrounds. Pick one as the starting background.</p>
      {stepErrors.backgrounds ? <p className="sc-error">{stepErrors.backgrounds}</p> : null}
      <div className="sc-bg-stack">
        {data.backgrounds.map((bg) => renderBgCard(bg, true))}
        <div className="sc-bg-actions-row">
          <button type="button" className="sc-btn-ghost" disabled={!canAddBackground} onClick={addBackground}>
            {canAddBackground ? '+ Add background' : `Maximum ${tierLimits.backgrounds} backgrounds`}
          </button>
          <button type="button" className="sc-btn-ghost" disabled={!canAddBackground} onClick={openPublicBgModal}>
            Choose a public background
          </button>
        </div>
      </div>
    </div>
  )
}
