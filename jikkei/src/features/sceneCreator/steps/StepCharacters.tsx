import type { ChangeEvent, DragEvent, RefObject } from 'react'
import { ATTRIBUTE_PRESETS } from '../../../data/Attributepresets'
import { MAX_ATTRIBUTES } from '../types'
import type { WizardData, CharacterDraft, ErrorMap, ExpressionTab } from '../types'

interface Props {
  persMode: boolean
  data: WizardData
  activeCharIndex: number
  setActiveCharIndex: (i: number) => void
  activeChar: CharacterDraft | undefined
  activeExpressionTab: ExpressionTab | null
  canAddCharacter: boolean
  stepErrors: ErrorMap

  // character mutations
  updateCharacter: (id: string, patch: Partial<CharacterDraft>) => void
  addCharacter: () => void
  removeCharacter: (id: string) => void

  // avatar
  avatarInputRef: RefObject<HTMLInputElement | null>
  handleAvatarInputChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleAvatarDrop: (e: DragEvent<HTMLDivElement>) => void
  onOpenGenerateModal: () => void

  // expressions
  expressionInputRef: RefObject<HTMLInputElement | null>
  handleExpressionInputChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleExpressionDrop: (e: DragEvent<HTMLDivElement>) => void
  setActiveExpressionSlot: (slot: string) => void
  removeExpressionTab: (slot: string) => void
  onOpenAddExpressionModal: () => void

  // attributes
  openAttrModal: () => void
  updateAttributeValue: (attrKey: string, value: number) => void
  removeAttribute: (attrKey: string) => void
}

export function StepCharacters({
  persMode,
  data,
  activeCharIndex,
  setActiveCharIndex,
  activeChar,
  activeExpressionTab,
  canAddCharacter,
  stepErrors,
  updateCharacter,
  addCharacter,
  removeCharacter,
  avatarInputRef,
  handleAvatarInputChange,
  handleAvatarDrop,
  onOpenGenerateModal,
  expressionInputRef,
  handleExpressionInputChange,
  handleExpressionDrop,
  setActiveExpressionSlot,
  removeExpressionTab,
  onOpenAddExpressionModal,
  openAttrModal,
  updateAttributeValue,
  removeAttribute,
}: Props) {
  if (!activeChar) return null

  const charIndex = activeCharIndex
  const isReadOnly = persMode && activeChar.isOriginal

  const renderEditor = () => (
    <div className="sc-char-slide">
      <div className="sc-char-left">
        {!isReadOnly ? (
          <>
            <input
              ref={avatarInputRef}
              type="file"
              hidden
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarInputChange}
            />
            <div
              className="sc-dropzone"
              role="button"
              tabIndex={0}
              onClick={() => avatarInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleAvatarDrop}
            >
              {activeChar.avatarPreview || activeChar.avatarUrl ? (
                <>
                  <img src={activeChar.avatarPreview || activeChar.avatarUrl || ''} alt="Avatar preview" className="sc-dropzone-img" />
                  <span className="sc-btn-ghost sc-dropzone-change" onClick={(e) => e.stopPropagation()}>Change</span>
                </>
              ) : (
                <>
                  <strong>Drop image or click</strong>
                  <span>JPG, PNG, WEBP · max 5MB</span>
                </>
              )}
            </div>
            {(stepErrors[`char-avatar-${charIndex}`] || stepErrors[`char-avatar-new-${charIndex}`]) ? (
              <p className="sc-error">{stepErrors[`char-avatar-${charIndex}`] ?? stepErrors[`char-avatar-new-${charIndex}`]}</p>
            ) : null}
            <button type="button" className="sc-btn-ghost sc-btn-full" onClick={onOpenGenerateModal}>
              {activeChar.isGenerated ? '✓ Generated' : '✦ Generate'}
            </button>
          </>
        ) : (
          <div className="sc-char-avatar-readonly">
            {activeChar.avatarUrl
              ? <img src={activeChar.avatarUrl} alt={activeChar.name} className="sc-dropzone-img" />
              : <div className="sc-char-avatar-placeholder">No image</div>}
          </div>
        )}
      </div>

      <div className="sc-char-right">
        <label className="sc-field">
          <span className="sc-field-label">Character name</span>
          <input
            className="sc-input"
            type="text"
            maxLength={60}
            value={activeChar.name}
            readOnly={isReadOnly}
            onChange={isReadOnly ? undefined : (e) => updateCharacter(activeChar.id, { name: e.target.value })}
            style={isReadOnly ? { opacity: 0.6, cursor: 'default' } : undefined}
          />
          {!isReadOnly && (stepErrors[`char-name-${charIndex}`] || stepErrors[`char-name-new-${charIndex}`]) ? (
            <p className="sc-error">{stepErrors[`char-name-${charIndex}`] ?? stepErrors[`char-name-new-${charIndex}`]}</p>
          ) : null}
        </label>

        <label className="sc-field">
          <span className="sc-field-label">Description</span>
          <textarea
            className="sc-textarea"
            rows={4}
            maxLength={800}
            value={activeChar.description}
            readOnly={isReadOnly}
            onChange={isReadOnly ? undefined : (e) => updateCharacter(activeChar.id, { description: e.target.value })}
            style={isReadOnly ? { opacity: 0.6, cursor: 'default' } : undefined}
          />
          {!isReadOnly && (stepErrors[`char-desc-${charIndex}`] || stepErrors[`char-desc-new-${charIndex}`]) ? (
            <p className="sc-error">{stepErrors[`char-desc-${charIndex}`] ?? stepErrors[`char-desc-new-${charIndex}`]}</p>
          ) : null}
        </label>

        <label className="sc-field">
          <span className="sc-field-label">Initial dialogue</span>
          <textarea
            className="sc-textarea"
            rows={2}
            maxLength={400}
            value={activeChar.initialDialogue}
            readOnly={isReadOnly}
            onChange={isReadOnly ? undefined : (e) => updateCharacter(activeChar.id, { initialDialogue: e.target.value })}
            style={isReadOnly ? { opacity: 0.6, cursor: 'default' } : undefined}
          />
        </label>

        {!isReadOnly && (
          <div className="sc-field">
            <span className="sc-field-label">Expressions</span>
            <div className="sc-expr-tabs">
              {activeChar.expressions.map((expr) => (
                <button
                  key={expr.slotKey}
                  type="button"
                  className={`sc-expr-tab ${activeChar.activeExpressionSlot === expr.slotKey ? 'sc-expr-tab-active' : ''}`}
                  onClick={() => setActiveExpressionSlot(expr.slotKey)}
                >
                  {(expr.preview || expr.imageUrl) ? <span className="sc-expr-tab-dot" /> : null}
                  {expr.displayName}
                  <span className="sc-expr-tab-x" onClick={(e) => { e.stopPropagation(); removeExpressionTab(expr.slotKey) }}>×</span>
                </button>
              ))}
              <button type="button" className="sc-expr-add-tab" onClick={onOpenAddExpressionModal} title="Add expression">+</button>
            </div>

            {activeExpressionTab ? (
              <>
                <input
                  ref={expressionInputRef}
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleExpressionInputChange}
                />
                <div
                  className="sc-dropzone sc-expr-dropzone"
                  role="button"
                  tabIndex={0}
                  onClick={() => expressionInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleExpressionDrop}
                >
                  {activeExpressionTab.preview || activeExpressionTab.imageUrl ? (
                    <>
                      <img src={activeExpressionTab.preview || activeExpressionTab.imageUrl || ''} alt={`${activeExpressionTab.displayName} preview`} className="sc-dropzone-img" />
                      <span className="sc-btn-ghost sc-dropzone-change" onClick={(e) => e.stopPropagation()}>Change</span>
                    </>
                  ) : (
                    <>
                      <strong>Drop image for "{activeExpressionTab.displayName}"</strong>
                      <span>JPG, PNG, WEBP · max 5MB</span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="sc-section-hint">No expressions added yet. Click + to add one (optional).</p>
            )}
          </div>
        )}
      </div>
    </div>
  )

  const renderAttributes = () => {
    if (isReadOnly) {
      return (
        <div className="sc-card-soft">
          <div className="sc-section-label"><span className="sc-dot" /><span className="sc-section-title">Attributes</span></div>
          {activeChar.attributes.length > 0 ? (
            <div className="sc-attr-list">
              {activeChar.attributes.map((attr) => {
                const preset = ATTRIBUTE_PRESETS.find((p) => p.key === attr.attrKey)
                return (
                  <div key={attr.attrKey} className="sc-attr-row sc-attr-row-readonly">
                    <span className="sc-attr-name">{preset?.label ?? attr.attrKey}</span>
                    <input type="range" className="sc-attr-slider" min={attr.minValue} max={attr.maxValue} value={attr.initialValue} readOnly style={{ opacity: 0.5, pointerEvents: 'none' }} />
                    <span className="sc-attr-value">{attr.initialValue}</span>
                  </div>
                )
              })}
            </div>
          ) : <p className="sc-section-hint">No attributes.</p>}
        </div>
      )
    }

    return (
      <div className="sc-card-soft">
        <div className="sc-section-label"><span className="sc-dot" /><span className="sc-section-title">Attributes</span></div>
        <p className="sc-section-hint">Pick up to {MAX_ATTRIBUTES} from the catalog.</p>
        {(stepErrors[`char-attrs-${charIndex}`] || stepErrors[`char-attrs-new-${charIndex}`]) ? (
          <p className="sc-error">{stepErrors[`char-attrs-${charIndex}`] ?? stepErrors[`char-attrs-new-${charIndex}`]}</p>
        ) : null}
        {activeChar.attributes.length > 0 ? (
          <div className="sc-attr-list">
            {activeChar.attributes.map((attr) => {
              const preset = ATTRIBUTE_PRESETS.find((p) => p.key === attr.attrKey)
              return (
                <div key={attr.attrKey} className="sc-attr-row">
                  <span className="sc-attr-name">{preset?.label ?? attr.attrKey}</span>
                  <input
                    type="range"
                    className="sc-attr-slider"
                    min={attr.minValue}
                    max={attr.maxValue}
                    value={attr.initialValue}
                    onChange={(e) => updateAttributeValue(attr.attrKey, Number(e.target.value))}
                  />
                  <span className="sc-attr-value">{attr.initialValue}</span>
                  <button type="button" className="sc-icon-btn" onClick={() => removeAttribute(attr.attrKey)}>×</button>
                </div>
              )
            })}
          </div>
        ) : <p className="sc-section-hint">No attributes selected yet.</p>}
        <button type="button" className="sc-btn-ghost" onClick={openAttrModal}>Select attributes</button>
      </div>
    )
  }

  return (
    <div className="sc-step-body">
      {persMode && (
        <div className="sc-pers-notice">
          <span className="sc-pers-notice-icon">ℹ</span>
          Original characters are read-only. You can add new session-only characters below.
        </div>
      )}

      <div className="sc-slide-nav">
        {data.characters.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={`sc-slide-tab ${i === activeCharIndex ? 'sc-slide-tab-active' : ''} ${persMode && c.isOriginal ? 'sc-slide-tab-original' : ''}`}
            onClick={() => setActiveCharIndex(i)}
          >
            {c.avatarPreview
              ? <img src={c.avatarPreview} alt="" className="sc-slide-tab-avatar" />
              : c.avatarUrl
                ? <img src={c.avatarUrl} alt="" className="sc-slide-tab-avatar" />
                : <span className="sc-slide-tab-avatar" />}
            {c.name.trim() || `Character ${i + 1}`}
            {persMode && c.isOriginal && <span className="sc-slide-tab-original-badge">original</span>}
            {persMode && !c.isOriginal ? (
              <span className="sc-slide-tab-remove" onClick={(e) => { e.stopPropagation(); removeCharacter(c.id) }}>×</span>
            ) : null}
            {!persMode && data.characters.length > 1 ? (
              <span className="sc-slide-tab-remove" onClick={(e) => { e.stopPropagation(); removeCharacter(c.id) }}>×</span>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          className="sc-slide-add"
          onClick={addCharacter}
          disabled={!canAddCharacter}
          title={canAddCharacter ? 'Add character' : 'Maximum reached'}
        >+</button>
      </div>

      <div className="sc-card">
        {isReadOnly && (
          <div className="sc-readonly-banner">
            <span>🔒 Original character — read only in personalized mode</span>
          </div>
        )}
        {renderEditor()}
      </div>

      {renderAttributes()}
    </div>
  )
}
