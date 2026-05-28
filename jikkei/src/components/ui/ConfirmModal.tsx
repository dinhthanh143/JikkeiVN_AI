import './modal.css'
import { createPortal } from 'react-dom'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isConfirming?: boolean
  onConfirm: () => void
  onCancel: () => void
  // When false, only the cancel button renders (e.g. a premium user seeing
  // an "out of credits" notice has no upgrade action to offer — see
  // CreditsExhaustedModal, TASK-011).
  showConfirm?: boolean
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'CONFIRM',
  cancelText = 'CANCEL',
  isConfirming = false,
  onConfirm,
  onCancel,
  showConfirm = true,
}: ConfirmModalProps) {
  if (!isOpen) {
    return null
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="jk-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="jk-confirm-modal-title">
      <div className="jk-modal-card">
        <div className="jk-modal-head">
          <span className="jk-modal-icon" aria-hidden="true">
            !
          </span>
          <h3 id="jk-confirm-modal-title" className="jk-modal-title">
            {title}
          </h3>
        </div>
        <p className="jk-modal-text">{message}</p>
        <div className="jk-modal-actions">
          <button type="button" className="jk-modal-btn" onClick={onCancel} disabled={isConfirming}>
            {cancelText}
          </button>
          {showConfirm && (
            <button type="button" className="jk-modal-btn jk-modal-btn-confirm" onClick={onConfirm} disabled={isConfirming}>
              {isConfirming ? 'WORKING...' : confirmText}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
