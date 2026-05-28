import './modal.css'
import { createPortal } from 'react-dom'

interface SuccessModalProps {
  isOpen: boolean
  title?: string
  message: string
  buttonText?: string
  onClose: () => void
}

export default function SuccessModal({
  isOpen,
  title = 'SUCCESSFULLY DONE',
  message,
  buttonText = 'CONTINUE',
  onClose,
}: SuccessModalProps) {
  if (!isOpen) {
    return null
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="jk-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="jk-success-modal-title">
      <div className="jk-modal-card jk-modal-success">
        <div className="jk-modal-head">
          <span className="jk-modal-icon" aria-hidden="true">
            ✓
          </span>
          <h3 id="jk-success-modal-title" className="jk-modal-title">
            {title}
          </h3>
        </div>
        <p className="jk-modal-text">{message}</p>
        <div className="jk-modal-actions">
          <button type="button" className="jk-modal-btn jk-modal-btn-confirm" onClick={onClose}>
            {buttonText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
