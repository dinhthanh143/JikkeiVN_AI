/**
 * AudioManager — global singleton, mounted once inside AuthInitializer.
 *
 * Responsibilities:
 *  - SFX: volume + enabled state are read live by playHover/playClick at
 *    call-time, so no extra wiring is needed here for SFX.
 *  - BGM: watches the store for track / volume / enabled / muted changes
 *    and drives a single persistent Howl. Fades between tracks.
 *    ⚠️  No BGM files exist yet — the manager is fully wired but silently
 *    no-ops until real files are placed in src/audio/bgm/ and the track
 *    registry below is populated.
 *
 * Render: null — this component produces no DOM.
 */

import { useEffect, useRef } from 'react'
import { Howl } from 'howler'
import { useAudioStore } from '@/store/useAudioStore'

// ── BGM Track Registry ────────────────────────────────────────────────────────
// When you add a BGM file, import it here and add an entry.
// Pages call useAudioStore.getState().setTrack('menu') to switch tracks.
//
// Example (uncomment when files are ready):
//   import menuBgm from '@/audio/bgm/menu.mp3'
//   import storyBgm from '@/audio/bgm/story.mp3'
//
const BGM_REGISTRY: Record<string, string> = {
  // menu:  menuBgm,
  // story: storyBgm,
}

const FADE_DURATION_MS = 800

// ── Component ─────────────────────────────────────────────────────────────────

export default function AudioManager() {
  const currentTrack  = useAudioStore((s) => s.currentTrack)
  const musicVolume   = useAudioStore((s) => s.musicVolume)
  const musicEnabled  = useAudioStore((s) => s.musicEnabled)
  const isMuted       = useAudioStore((s) => s.isMuted)

  // Single persistent Howl instance for BGM — swapped on track change
  const howlRef        = useRef<Howl | null>(null)
  const activeTrackRef = useRef<string | null>(null)

  // ── Track switching ──────────────────────────────────────────────────────
  useEffect(() => {
    const url = currentTrack ? BGM_REGISTRY[currentTrack] : null

    // Same track already playing — nothing to do
    if (currentTrack === activeTrackRef.current) return

    const prev = howlRef.current

    // Fade out the old track then destroy it
    if (prev) {
      prev.fade(prev.volume(), 0, FADE_DURATION_MS)
      setTimeout(() => { prev.stop(); prev.unload() }, FADE_DURATION_MS)
      howlRef.current = null
    }

    activeTrackRef.current = currentTrack

    // No track, or track not in registry yet → stop here (silent no-op)
    if (!url) return

    const effectiveVolume = musicEnabled && !isMuted ? musicVolume : 0

    const next = new Howl({
      src:    [url],
      loop:   true,
      volume: 0,       // start silent, then fade in
      html5:  true,    // stream instead of decode-all (better for long BGM)
    })

    next.once('play', () => {
      next.fade(0, effectiveVolume, FADE_DURATION_MS)
    })

    next.play()
    howlRef.current = next
  }, [currentTrack]) // eslint-disable-line react-hooks/exhaustive-deps
  // ^ intentionally excludes musicEnabled/isMuted/musicVolume —
  //   those are handled by the volume effect below so a mid-song
  //   volume change doesn't trigger a full track restart.

  // ── Live volume / enabled / mute ─────────────────────────────────────────
  useEffect(() => {
    const h = howlRef.current
    if (!h) return
    const target = musicEnabled && !isMuted ? musicVolume : 0
    h.fade(h.volume(), target, 200)
  }, [musicVolume, musicEnabled, isMuted])

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      howlRef.current?.stop()
      howlRef.current?.unload()
      howlRef.current = null
    }
  }, [])

  return null
}
