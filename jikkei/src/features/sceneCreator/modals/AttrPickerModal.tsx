import { ATTRIBUTE_PRESETS } from '../../../data/Attributepresets'
import { MAX_ATTRIBUTES } from '../types'

interface Props {
  selection: Set<string>
  onToggle: (key: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function AttrPickerModal({ selection, onToggle, onConfirm, onClose }: Props) {
  return (
    <div className="sc-modal-overlay" onClick={onClose}>
      <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sc-modal-head-row">
          <h3>Select attributes</h3>
          <span className="sc-counter">{selection.size} / {MAX_ATTRIBUTES}</span>
        </div>
        <div className="sc-attr-picker-grid">
          {ATTRIBUTE_PRESETS.map((preset) => {
            const selected = selection.has(preset.key)
            const disabled = !selected && selection.size >= MAX_ATTRIBUTES
            return (
              <div
                key={preset.key}
                className={`sc-attr-picker-item ${selected ? 'sc-attr-picker-item-selected' : ''} ${disabled ? 'sc-attr-picker-item-disabled' : ''}`}
                onClick={() => !disabled && onToggle(preset.key)}
              >
                <span className="sc-attr-picker-check">{selected ? '✓' : ''}</span>
                {preset.label}
              </div>
            )
          })}
        </div>
        <div className="sc-modal-actions">
          <button type="button" className="sc-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="sc-btn-primary" onClick={onConfirm}>Apply</button>
        </div>
      </div>
    </div>
  )
}
