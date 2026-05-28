import { MAX_START_CHOICES } from '../types'
import type { WizardData, ErrorMap } from '../types'

interface Props {
  data: WizardData
  canAddStartChoice: boolean
  stepErrors: ErrorMap
  addStartChoice: () => void
  updateStartChoice: (id: string, text: string) => void
  removeStartChoice: (id: string) => void
}

export function StepChoices({
  data,
  canAddStartChoice,
  stepErrors,
  addStartChoice,
  updateStartChoice,
  removeStartChoice,
}: Props) {
  return (
    <div className="sc-step-body">
      <div className="sc-card">
        <div className="sc-section-label"><span className="sc-dot" /><span className="sc-section-title">Starting choices</span></div>
        <p className="sc-section-hint">Shown to the player on their very first turn. Describe an action, not dialogue.</p>
        {stepErrors.choices ? <p className="sc-error">{stepErrors.choices}</p> : null}
        <div className="sc-choice-list">
          {data.startChoices.map((choice, i) => (
            <div key={choice.id} className="sc-choice-row">
              <span className="sc-choice-index">{i + 1}</span>
              <input
                className="sc-input"
                placeholder='e.g. "Calls her a show-off"'
                maxLength={80}
                value={choice.choiceText}
                onChange={(e) => updateStartChoice(choice.id, e.target.value)}
              />
              <button type="button" className="sc-icon-btn" onClick={() => removeStartChoice(choice.id)}>×</button>
            </div>
          ))}
        </div>
        <button type="button" className="sc-btn-ghost" disabled={!canAddStartChoice} onClick={addStartChoice}>
          {canAddStartChoice ? '+ Add choice' : `Maximum ${MAX_START_CHOICES} choices`}
        </button>
      </div>
    </div>
  )
}
