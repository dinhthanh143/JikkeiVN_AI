interface Props {
  prompt: string
  isGenerating: boolean
  onChange: (v: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function GenerateArtModal({ prompt, isGenerating, onChange, onConfirm, onClose }: Props) {
  return (
    <div className="sc-modal-overlay" onClick={() => !isGenerating && onClose()}>
      <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Generate character art</h3>
        <label className="sc-field">
          <span className="sc-field-label">Describe your character</span>
          <textarea
            className="sc-textarea"
            rows={4}
            maxLength={500}
            autoFocus
            placeholder="e.g. Silver-haired knight in ornate armor..."
            value={prompt}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="sc-counter">{prompt.length} / 500</span>
        </label>
        <div className="sc-modal-actions">
          <button
            type="button"
            className="sc-btn-ghost"
            disabled={isGenerating}
            onClick={() => { onClose() }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sc-btn-primary"
            disabled={isGenerating || !prompt.trim()}
            onClick={onConfirm}
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
