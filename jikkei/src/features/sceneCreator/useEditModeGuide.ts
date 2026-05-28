import { useEffect, useState } from 'react'
import { EDIT_MODE_GUIDE_STORAGE_KEY } from './types'

/**
 * useEditModeGuide
 * Decides whether to show the edit-mode guidance modal: only relevant in
 * edit mode (a brand-new story has no "original vs personalized" choice
 * yet), and only if the user hasn't dismissed it with "Do not show again"
 * before.
 *
 * localStorage read is guarded (try/catch + typeof window check) since
 * private browsing / disabled storage can throw on access, and that must
 * never block the page from loading.
 */
export function useEditModeGuide(isEditMode: boolean) {
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    if (!isEditMode) return
    let alreadyDismissed = false
    try {
      alreadyDismissed = window.localStorage.getItem(EDIT_MODE_GUIDE_STORAGE_KEY) === '1'
    } catch {
      alreadyDismissed = false
    }
    if (!alreadyDismissed) setShowGuide(true)
  }, [isEditMode])

  const closeGuide = (dontShowAgain: boolean) => {
    setShowGuide(false)
    if (!dontShowAgain) return
    try {
      window.localStorage.setItem(EDIT_MODE_GUIDE_STORAGE_KEY, '1')
    } catch {
      // Storage unavailable (private mode, quota, etc.) — silently skip.
      // Worst case the modal reappears next visit, which is harmless.
    }
  }

  return { showGuide, closeGuide }
}
