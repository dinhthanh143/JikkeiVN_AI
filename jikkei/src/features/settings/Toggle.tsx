interface ToggleProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`st-toggle ${checked ? 'st-toggle--on' : ''} ${disabled ? 'st-toggle--disabled' : ''}`}
    >
      <span className="st-toggle-knob" />
    </button>
  )
}
