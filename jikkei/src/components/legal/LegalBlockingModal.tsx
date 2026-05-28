import { useState } from 'react'

interface LegalBlockingModalProps {
  requiredVersion: string
  onAccept: () => Promise<void>
}

export default function LegalBlockingModal({ requiredVersion, onAccept }: LegalBlockingModalProps) {
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleAccept = async () => {
    if (!checked || submitting) {
      return
    }
    setSubmitting(true)
    try {
      await onAccept()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="legal-lock-overlay" role="dialog" aria-modal>
      <div className="legal-lock-card">
        <p className="legal-lock-eyebrow">// LEGAL_UPDATE_REQUIRED</p>
        <h2 className="legal-lock-title">Action Required Before Continuing</h2>
        <p className="legal-lock-copy">
          The legal documents were updated. You must review and accept the latest versions before
          using Jikkei.
        </p>
        <p className="legal-lock-version">Required bundle: {requiredVersion}</p>

        <label className="legal-lock-checkbox-row">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="legal-lock-checkbox"
          />
          <span className="legal-lock-checkbox-text">
            I agree to the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="legal-lock-link">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="legal-lock-link">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        <button
          type="button"
          className="legal-lock-accept"
          disabled={!checked || submitting}
          onClick={handleAccept}
        >
          {submitting ? 'Saving...' : 'Accept and Continue'}
        </button>
      </div>
    </div>
  )
}
