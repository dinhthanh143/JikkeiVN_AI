import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ConfirmModal } from '@/components/ui'
import { useSettingsState } from '../../features/settings/useSettingsState'
import { AccountTab } from '../../features/settings/tabs/AccountTab'
import { GameTab } from '../../features/settings/tabs/GameTab'
import { SubscriptionTab } from '../../features/subscription/SubscriptionTab'
import type { SettingsTab } from '../../features/settings/types'
import '../../styles/SettingsPanel.css'

export function SettingsPanel() {
  const s = useSettingsState()
  const location = useLocation()
  // TASK-011: CreditsExhaustedModal's "Upgrade to Premium" navigates here
  // with { state: { tab: 'subscription' } } to land directly on the
  // Subscription tab instead of the default Account tab.
  const initialTab = (location.state as { tab?: SettingsTab } | null)?.tab
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab ?? 'account')

  return (
    <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="panel-header">
        <span className="panel-eyebrow">// USER_PROFILE</span>
        <h2 className="panel-title">SETTINGS</h2>
      </div>

      <div className="settings-tab-row">
        {(['account', 'subscription', 'game'] as const).map((tab) => (
          <button
            key={tab} type="button"
            className={`settings-tab-btn ${activeTab === tab ? 'settings-tab-btn-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'account' ? (
        <AccountTab
          user={s.user} userId={s.userId} role={s.role}
          displayName={s.displayName} avatarSrc={s.avatarSrc} initial={s.initial}
          handleAvatarFile={s.handleAvatarFile}
          copyHint={s.copyHint} handleCopyId={s.handleCopyId}
          setShowLogoutConfirm={s.setShowLogoutConfirm}
          setShowLogoutAllConfirm={s.setShowLogoutAllConfirm}
        />
      ) : activeTab === 'subscription' ? (
        <SubscriptionTab />
      ) : (
        <>
          <GameTab
            bgmVolume={s.bgmVolume} setBgmVolume={s.setBgmVolume}
            bgmEnabled={s.bgmEnabled} setBgmEnabled={s.setBgmEnabled}
            sfxVolume={s.sfxVolume} setSfxVolume={s.setSfxVolume}
            sfxEnabled={s.sfxEnabled} setSfxEnabled={s.setSfxEnabled}
            textSfxEnabled={s.textSfxEnabled} setTextSfxEnabled={s.setTextSfxEnabled}
            textSfxVolume={s.textSfxVolume} setTextSfxVolume={s.setTextSfxVolume}
            textSfxType={s.textSfxType} handleTextTypeChange={s.handleTextTypeChange}
            autoPlay={s.autoPlay} setAutoPlay={s.setAutoPlay}
            language={s.language} setLanguage={s.setLanguage}
          />
          <div className="st-save-row">
            <button
              type="button"
              className={`st-save-btn st-save-btn--${s.saveState}`}
              disabled={s.saveState === 'saving'}
              onClick={() => { void s.handleSaveGame() }}
            >
              {s.saveState === 'idle' ? 'SAVE CHANGES' : s.saveState === 'saving' ? 'SAVING…' : s.saveState === 'success' ? '✓ SAVED' : 'FAILED — RETRY'}
            </button>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={s.showLogoutConfirm} title="LOG OUT"
        message="Are you sure you want to log out?"
        confirmText="LOG OUT" cancelText="STAY" isConfirming={s.isLoggingOut}
        onConfirm={() => { void s.handleLogoutConfirm() }}
        onCancel={() => s.setShowLogoutConfirm(false)}
      />
      <ConfirmModal
        isOpen={s.showLogoutAllConfirm} title="LOG OUT ALL DEVICES"
        message="This will revoke all active sessions across every device. You will need to log in again."
        confirmText="REVOKE ALL" cancelText="CANCEL" isConfirming={s.isLoggingOut}
        onConfirm={() => { void s.handleLogoutAllConfirm() }}
        onCancel={() => s.setShowLogoutAllConfirm(false)}
      />
    </div>
  )
}
