export type SettingsTab = 'account' | 'game' | 'subscription'
export type SaveState = 'idle' | 'saving' | 'success' | 'error'

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
] as const

export type LangCode = (typeof LANGUAGES)[number]['code']
export type TextType = 1 | 2 | 3
export const TEXT_TYPES: TextType[] = [1, 2, 3]
