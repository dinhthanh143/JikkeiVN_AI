// TASK-011 — exhausted-state modal. Reuses ConfirmModal (not a rebuild) via
// its showConfirm prop for the tier-aware button set:
//   free    → "Upgrade to Premium" (confirm) + "Close" (cancel)
//   premium → "Close" only (no upsell for someone already on the top plan)
import { useNavigate } from 'react-router-dom'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useSubscription } from '@/features/subscription/useSubscription'
import { formatResetTime } from './formatResetTime'

interface CreditsExhaustedModalProps {
  isOpen: boolean
  resetsAt: string | null
  onClose: () => void
}

export default function CreditsExhaustedModal({ isOpen, resetsAt, onClose }: CreditsExhaustedModalProps) {
  const navigate = useNavigate()
  const { currentTier } = useSubscription()

  const message = resetsAt
    ? `You're out of credits. Unavailable until ${formatResetTime(resetsAt)}.`
    : "You're out of credits for now."

  return (
    <ConfirmModal
      isOpen={isOpen}
      title="Out of credits"
      message={message}
      cancelText="Close"
      confirmText="Upgrade to Premium"
      showConfirm={currentTier !== 'premium'}
      onCancel={onClose}
      onConfirm={() => {
        onClose()
        // SettingsPanel reads location.state.tab to preselect the
        // Subscription tab — see SettingsPanel.tsx.
        navigate('/settings', { state: { tab: 'subscription' } })
      }}
    />
  )
}
