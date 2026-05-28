import type { ChangeEvent } from 'react'
import type { SettingsState } from '../useSettingsState'
import { useCredits } from '@/features/credits/useCredits'
import { CreditsCard } from './CreditsCard'

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}
function truncateId(id: string | null): string {
  if (!id) return 'UNASSIGNED'
  return `${id.slice(0, 8)}...${id.slice(-4)}`
}

type Props = Pick<
  SettingsState,
  | 'user' | 'userId' | 'role'
  | 'displayName' | 'avatarSrc' | 'initial'
  | 'handleAvatarFile'
  | 'copyHint' | 'handleCopyId'
  | 'setShowLogoutConfirm' | 'setShowLogoutAllConfirm'
>

export function AccountTab({
  user, userId, role,
  displayName, avatarSrc, initial,
  handleAvatarFile, copyHint, handleCopyId,
  setShowLogoutConfirm, setShowLogoutAllConfirm,
}: Props) {
  // TASK-011 — real credits data (was mocked via useAccountData before the
  // rolling-window credit system existed).
  const { credits } = useCredits()

  return (
    <section className="settings-grid settings-grid--account">
      <article className="settings-card settings-account-main">
        <p className="settings-kicker">PRIMARY PROFILE</p>
        <div className="settings-avatar-row">
          <label className="settings-avatar-wrap" title="Change avatar">
            <input type="file" accept="image/*" onChange={handleAvatarFile as (e: ChangeEvent<HTMLInputElement>) => void} hidden />
            <div className="settings-avatar">
              {avatarSrc
                ? <img src={avatarSrc} alt={displayName} className="settings-avatar-img" />
                : <span className="settings-avatar-initial">{initial}</span>}
            </div>
            <div className="settings-avatar-overlay"><span className="settings-avatar-overlay-label">CHANGE</span></div>
          </label>
          <div className="settings-identity">
            <div className="settings-name-row">
              <h3 className="settings-heading">{displayName}</h3>
              {role && (
                <span className={`settings-role-badge ${role === 'admin' ? 'settings-role-badge--admin' : ''}`}>
                  {role.toUpperCase()}
                </span>
              )}
            </div>
            {user?.email && <p className="settings-subtext">{user.email}</p>}
            {user?.created_at && (
              <p className="settings-subtext settings-subtext--muted">
                Member since {formatJoinDate(user.created_at)}
              </p>
            )}
            <button type="button" className="settings-id-chip" onClick={handleCopyId} title="Click to copy full ID">
              <span className="settings-id-label">ID</span>
              <span className="settings-id-value">{truncateId(userId)}</span>
              <span className="settings-id-copy">{copyHint ? '✓' : '⧉'}</span>
            </button>
          </div>
        </div>

        <div className="settings-actions">
          <button type="button" className="settings-action-btn">CHANGE PASSWORD</button>
          <button type="button" className="settings-danger-btn" onClick={() => setShowLogoutConfirm(true)}>LOG OUT</button>
          <button type="button" className="settings-danger-btn settings-danger-btn--ghost" onClick={() => setShowLogoutAllConfirm(true)}>ALL DEVICES</button>
        </div>
      </article>

      <CreditsCard data={credits} isLoading={credits === null} />
    </section>
  )
}
