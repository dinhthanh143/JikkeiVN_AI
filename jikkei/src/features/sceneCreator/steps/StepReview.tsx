import type { WizardData } from '../types'

interface Props {
  persMode: boolean
  isEditMode: boolean
  data: WizardData
  isSubmitting: boolean
  onSubmit: () => void
}

export function StepReview({ persMode, isEditMode, data, isSubmitting, onSubmit }: Props) {
  const newChars = persMode ? data.characters.filter((c) => !c.isOriginal) : data.characters
  const newBgs = persMode ? data.backgrounds.filter((b) => !b.isOriginal) : data.backgrounds
  const startingBg = data.backgrounds.find((b) => b.id === data.startingBackgroundId)

  return (
    <div className="sc-step-body">
      {persMode && (
        <div className="sc-pers-notice">
          <span className="sc-pers-notice-icon">ℹ</span>
          These are your personalized additions — they only affect your own sessions.
        </div>
      )}

      <div className="sc-review-grid">
        {!persMode && (
          <div className="sc-card sc-review-wide">
            <div className="sc-section-label"><span className="sc-dot" /><span className="sc-section-title">Story</span></div>
            <p className="sc-review-name">{data.title || 'Untitled story'}</p>
            <p className="sc-review-sub">{data.description.slice(0, 160)}{data.description.length > 160 ? '...' : ''}</p>
            <p className="sc-review-sub">{data.gameMode.toUpperCase()} mode · {data.isNsfw ? 'Mature' : 'All ages'} · {data.tier}</p>
          </div>
        )}

        {persMode && startingBg && (
          <div className="sc-card sc-review-wide">
            <div className="sc-section-label"><span className="sc-dot" /><span className="sc-section-title">Starting background</span></div>
            <div className="sc-review-bg-strip">
              <div className="sc-review-bg-item">
                {startingBg.preview || startingBg.imageUrl
                  ? <img src={startingBg.preview || startingBg.imageUrl || ''} alt={startingBg.name} />
                  : <div className="sc-review-placeholder-sm">No image</div>}
                <span>{startingBg.name}</span>
                {startingBg.isOriginal && <small style={{ color: 'var(--plum-soft)' }}>original</small>}
              </div>
            </div>
          </div>
        )}

        {newChars.length > 0 && (
          <div className="sc-card">
            <div className="sc-section-label">
              <span className="sc-dot" />
              <span className="sc-section-title">{persMode ? 'Added characters' : 'Characters'}</span>
            </div>
            {newChars.map((c) => (
              <div key={c.id} className="sc-review-char-row">
                {c.avatarPreview || c.avatarUrl
                  ? <img src={c.avatarPreview || c.avatarUrl || ''} alt={c.name} />
                  : <div className="sc-review-placeholder-sm">No image</div>}
                <div>
                  <p className="sc-review-name">{c.name || 'Unnamed'}</p>
                  <p className="sc-review-sub">{c.attributes.length} attributes · {c.expressions.length} expressions</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!persMode && (
          <div className="sc-card">
            <div className="sc-section-label"><span className="sc-dot" /><span className="sc-section-title">Starting choices</span></div>
            <ol className="sc-section-hint">
              {data.startChoices.filter((c) => c.choiceText.trim()).map((c) => <li key={c.id}>{c.choiceText}</li>)}
            </ol>
          </div>
        )}

        {newBgs.length > 0 && (
          <div className="sc-card sc-review-wide">
            <div className="sc-section-label">
              <span className="sc-dot" />
              <span className="sc-section-title">{persMode ? 'Added backgrounds' : 'Backgrounds'}</span>
            </div>
            <div className="sc-review-bg-strip">
              {newBgs.map((bg) => (
                <div key={bg.id} className="sc-review-bg-item">
                  {bg.preview || bg.imageUrl
                    ? <img src={bg.preview || bg.imageUrl || ''} alt={bg.name} />
                    : <div className="sc-review-placeholder-sm">No image</div>}
                  <span>{bg.name}</span>
                  {data.startingBackgroundId === bg.id ? <small>START</small> : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          className="sc-btn-primary sc-btn-full"
          disabled={isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting
            ? 'Saving...'
            : persMode
              ? 'Apply personalized edits'
              : isEditMode
                ? 'Save changes'
                : 'Create story'}
        </button>
      </div>
    </div>
  )
}
