import { type ChangeEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useAudioStore } from '../../store/useAudioStore'
import { authService } from '../../services/authService'
import { previewTextPlip } from '../../audio/sfx'
import type { LangCode, SaveState, TextType } from './types'

export function useSettingsState() {
  const navigate = useNavigate()
  const { user, userId, username, role, logout } = useAuth()
  const { settings, updateSettingsLocal } = usePlayerStore()
  const applyUserSettings = useAudioStore((s) => s.applyUserSettings)

  // ── UI state ──────────────────────────────────────────────
  const [showLogoutConfirm,    setShowLogoutConfirm]    = useState(false)
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false)
  const [isLoggingOut,         setIsLoggingOut]         = useState(false)
  const [avatarPreview,        setAvatarPreview]        = useState<string | null>(null)
  const [copyHint,             setCopyHint]             = useState(false)

  // ── Game settings local state ─────────────────────────────
  const [bgmVolume,      setBgmVolume]      = useState<number>(settings?.bgm_volume        ?? 80)
  const [bgmEnabled,     setBgmEnabled]     = useState<boolean>(settings?.bgm_enabled      ?? true)
  const [sfxVolume,      setSfxVolume]      = useState<number>(settings?.sfx_volume        ?? 80)
  const [sfxEnabled,     setSfxEnabled]     = useState<boolean>(settings?.sfx_enabled      ?? true)
  const [autoPlay,       setAutoPlay]       = useState<boolean>(settings?.auto_play        ?? false)
  const [language,       setLanguage]       = useState<LangCode>((settings?.language as LangCode) ?? 'en')
  const [textSfxEnabled, setTextSfxEnabled] = useState<boolean>(settings?.text_sfx_enabled ?? true)
  const [textSfxVolume,  setTextSfxVolume]  = useState<number>(settings?.text_sfx_volume   ?? 60)
  const [textSfxType,    setTextSfxType]    = useState<TextType>((settings?.text_sfx_type as TextType) ?? 1)
  const [saveState,      setSaveState]      = useState<SaveState>('idle')

  // ── Derived ───────────────────────────────────────────────
  const displayName = username || 'OPERATOR_01'
  const avatarSrc   = avatarPreview || user?.avatar_url || null
  const initial     = displayName.charAt(0).toUpperCase()

  // ── Handlers ──────────────────────────────────────────────
  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true)
    try { await logout(); setShowLogoutConfirm(false); navigate('/auth') }
    finally { setIsLoggingOut(false) }
  }

  const handleLogoutAllConfirm = async () => {
    setIsLoggingOut(true)
    try { await authService.logoutAll(); setShowLogoutAllConfirm(false); navigate('/auth') }
    finally { setIsLoggingOut(false) }
  }

  const handleAvatarFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleCopyId = () => {
    if (!userId) return
    void navigator.clipboard.writeText(userId)
    setCopyHint(true)
    setTimeout(() => setCopyHint(false), 1500)
  }

  const handleTextTypeChange = (type: TextType) => {
    setTextSfxType(type)
    previewTextPlip(type, textSfxVolume)
  }

  const handleSaveGame = async () => {
    if (saveState === 'saving') return
    setSaveState('saving')
    try {
      const updated = await authService.updateSettings({
        bgm_volume: bgmVolume, bgm_enabled: bgmEnabled,
        sfx_volume: sfxVolume, sfx_enabled: sfxEnabled,
        auto_play: autoPlay, language,
        text_sfx_enabled: textSfxEnabled, text_sfx_volume: textSfxVolume, text_sfx_type: textSfxType,
      })
      updateSettingsLocal(updated)
      applyUserSettings({
        bgm_volume:       updated.bgm_volume,
        bgm_enabled:      updated.bgm_enabled,
        sfx_volume:       updated.sfx_volume,
        sfx_enabled:      updated.sfx_enabled,
        text_sfx_enabled: updated.text_sfx_enabled,
        text_sfx_volume:  updated.text_sfx_volume,
        text_sfx_type:    updated.text_sfx_type,
      })
      setSaveState('success')
      setTimeout(() => setSaveState('idle'), 1500)
    } catch (err) {
      console.error('[SettingsPanel] save error:', err)
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2000)
    }
  }

  return {
    // account
    user, userId, username, role,
    displayName, avatarSrc, initial,
    avatarPreview, handleAvatarFile,
    copyHint, handleCopyId,
    showLogoutConfirm, setShowLogoutConfirm,
    showLogoutAllConfirm, setShowLogoutAllConfirm,
    isLoggingOut,
    handleLogoutConfirm,
    handleLogoutAllConfirm,
    // game
    bgmVolume, setBgmVolume,
    bgmEnabled, setBgmEnabled,
    sfxVolume, setSfxVolume,
    sfxEnabled, setSfxEnabled,
    autoPlay, setAutoPlay,
    language, setLanguage,
    textSfxEnabled, setTextSfxEnabled,
    textSfxVolume, setTextSfxVolume,
    textSfxType,
    handleTextTypeChange,
    saveState, handleSaveGame,
  }
}

export type SettingsState = ReturnType<typeof useSettingsState>
