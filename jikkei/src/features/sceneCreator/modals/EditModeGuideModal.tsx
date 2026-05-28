import { useState } from 'react'

interface Props {
  onClose: (dontShowAgain: boolean) => void
}

/**
 * EditModeGuideModal
 * One-time guidance shown on first entry into edit mode (story already
 * exists), explaining the two edit modes available:
 *   - Original story edit  (author-only — edits the shared template)
 *   - Personalized story edit (anyone — edits their own private copy)
 *
 * Purely informational: no form state besides the dismissal checkbox.
 * Persistence of the "don't show again" choice is handled by the caller
 * (see useEditModeGuide.ts) — this component only reports the checkbox
 * value back via onClose.
 */
export function EditModeGuideModal({ onClose }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  return (
    <div className="sc-modal-overlay" onClick={() => onClose(dontShowAgain)}>
      <div
        className="sc-modal sc-modal-wide sc-guide-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-guide-title"
      >
        <h3 id="edit-guide-title">Two ways to edit this story</h3>

        <p className="sc-guide-intro">
          This story can be edited in two different ways. They affect different
          things, so it's worth knowing which one you're using before you make changes.
        </p>

        <div className="sc-guide-row sc-guide-row-original">
          <div className="sc-guide-row-head">
            <span className="sc-guide-pill sc-guide-pill-original">Original story edit</span>
            <span className="sc-guide-audience">Author only</span>
          </div>
          <p>
            Edits the <strong className="sc-guide-hl-original">shared template</strong> that
            every player starts from — the title, characters, backgrounds, and starting
            choices everyone sees by default. Only the <strong className="sc-guide-hl-original">
            story's original author</strong> can access this mode.
          </p>
        </div>

        <div className="sc-guide-row sc-guide-row-personalized">
          <div className="sc-guide-row-head">
            <span className="sc-guide-pill sc-guide-pill-personalized">Personalized story edit</span>
            <span className="sc-guide-audience">Everyone</span>
          </div>
          <p>
            Edits <strong className="sc-guide-hl-personalized">your own private copy</strong> of
            this story — extra characters, backgrounds, or choices you add here are{' '}
            <strong className="sc-guide-hl-personalized">visible only to you</strong> and never
            change the original template other players see.
          </p>
        </div>

        <label className="sc-guide-checkbox-row">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          <span>Do not show this again</span>
        </label>

        <div className="sc-modal-actions">
          <button type="button" className="sc-btn-primary" onClick={() => onClose(dontShowAgain)}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
