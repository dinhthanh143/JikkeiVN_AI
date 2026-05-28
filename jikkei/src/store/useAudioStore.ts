import { create } from 'zustand'

type MusicState = 'calm' | 'tense' | 'danger' | 'panic'

interface AudioStoreState {
  currentTrack: string | null
  musicVolume: number    // 0–1
  sfxVolume: number      // 0–1
  musicEnabled: boolean
  sfxEnabled: boolean
  textSfxEnabled: boolean
  textSfxVolume: number  // 0–1
  textSfxType: 1 | 2 | 3
  isMuted: boolean
  musicState: MusicState

  setTrack: (track: string | null) => void
  setMusicState: (state: MusicState) => void
  toggleMute: () => void
  setVolume: (type: 'music' | 'sfx', volume: number) => void
  /** Bulk-apply from UserSettings (volumes come in as 0-100 integers) */
  applyUserSettings: (s: {
    bgm_volume: number
    bgm_enabled: boolean
    sfx_volume: number
    sfx_enabled: boolean
    text_sfx_enabled: boolean
    text_sfx_volume: number
    text_sfx_type: 1 | 2 | 3
  }) => void
}

export const useAudioStore = create<AudioStoreState>((set) => ({
  currentTrack: null,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  musicEnabled: true,
  sfxEnabled: true,
  textSfxEnabled: true,
  textSfxVolume: 0.6,
  textSfxType: 1,
  isMuted: false,
  musicState: 'calm',

  setTrack: (track) => set({ currentTrack: track }),
  setMusicState: (musicState) => set({ musicState }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setVolume: (type, volume) =>
    set({ [type === 'music' ? 'musicVolume' : 'sfxVolume']: Math.max(0, Math.min(1, volume)) }),

  applyUserSettings: ({ bgm_volume, bgm_enabled, sfx_volume, sfx_enabled, text_sfx_enabled, text_sfx_volume, text_sfx_type }) =>
    set({
      musicVolume:    Math.max(0, Math.min(1, bgm_volume / 100)),
      musicEnabled:   bgm_enabled,
      sfxVolume:      Math.max(0, Math.min(1, sfx_volume / 100)),
      sfxEnabled:     sfx_enabled,
      textSfxEnabled: text_sfx_enabled,
      textSfxVolume:  Math.max(0, Math.min(1, text_sfx_volume / 100)),
      textSfxType:    text_sfx_type,
    }),
}))
