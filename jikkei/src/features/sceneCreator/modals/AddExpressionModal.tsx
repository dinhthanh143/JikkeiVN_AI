interface Props {
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function AddExpressionModal({ value, onChange, onConfirm, onClose }: Props) {
  return (
    <div className="sc-modal-overlay" onClick={onClose}>
      <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add expression</h3>
        <label className="sc-field">
          <span className="sc-field-label">Expression name</span>
          <input
            className="sc-input"
            autoFocus
            placeholder="e.g. Shy"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onConfirm() }}
          />
        </label>
        <div className="sc-modal-actions">
          <button type="button" className="sc-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="sc-btn-primary" onClick={onConfirm}>Add</button>
        </div>
      </div>
    </div>
  )
}
