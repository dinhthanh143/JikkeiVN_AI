import { Howl } from 'howler'
import hoverUrl  from './hover.wav'
import clickUrl  from './click.wav'
import plip1Url  from './text_plip_1.wav'
import plip2Url  from './text_plip_2.wav'
import plip3Url  from './text_plip_3.wav'
import { useAudioStore } from '@/store/useAudioStore'

const hoverSound = new Howl({ src: [hoverUrl], volume: 0.4 })
const clickSound = new Howl({ src: [clickUrl], volume: 0.5 })

// ── Per-type volume multipliers ───────────────────────────────────────────────
// Type 1 is naturally quieter than 2 & 3, so we boost it before applying
// the user's volume setting. The UI always shows the same 0-100 slider —
// this compensation is invisible to the player.
// To re-tune: change the multiplier here.
//   1.0 = no boost    1.3 = 30% louder    1.5 = 50% louder
const TYPE_VOLUME_MULTIPLIERS: Record<1 | 2 | 3, number> = {
  1: 1.5,   // ← adjust this value to taste
  2: 1.0,
  3: 1.0,
}

export const TEXT_PLIP_SOUNDS: Record<1 | 2 | 3, Howl> = {
  1: new Howl({ src: [plip1Url], volume: 1 }),
  2: new Howl({ src: [plip2Url], volume: 1 }),
  3: new Howl({ src: [plip3Url], volume: 1 }),
}

export const playHover = () => {
  const { sfxVolume, sfxEnabled, isMuted } = useAudioStore.getState()
  if (!sfxEnabled || isMuted) return
  hoverSound.volume(sfxVolume)
  hoverSound.play()
}

export const playClick = () => {
  const { sfxVolume, sfxEnabled, isMuted } = useAudioStore.getState()
  if (!sfxEnabled || isMuted) return
  clickSound.volume(sfxVolume)
  clickSound.play()
}

export const playTextPlip = () => {
  const { textSfxEnabled, textSfxVolume, textSfxType, isMuted } = useAudioStore.getState()
  if (!textSfxEnabled || isMuted) return
  const multiplier = TYPE_VOLUME_MULTIPLIERS[textSfxType]
  const vol = Math.min(1, textSfxVolume * multiplier)
  const sound = TEXT_PLIP_SOUNDS[textSfxType]
  sound.volume(vol)
  sound.play()
}

/** One-shot preview for SettingsPanel — bypasses enabled/muted flags */
export const previewTextPlip = (type: 1 | 2 | 3, volume: number) => {
  const multiplier = TYPE_VOLUME_MULTIPLIERS[type]
  const vol = Math.min(1, (volume / 100) * multiplier)
  TEXT_PLIP_SOUNDS[type].volume(vol)
  TEXT_PLIP_SOUNDS[type].play()
}
