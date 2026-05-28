# docs/stores.md — Zustand Stores

> Document every store shape here before writing code.

---

## useGameStore (`src/store/useGameStore.ts`) ✅

Client presentation state for the active backend-owned story session. Server data is hydrated by `features/story/useStoryController.ts`; components do not fetch directly.

```typescript
interface GameStore {
  session: SessionSlice | null
  sessionChars: SessionCharacterRecord[]
  currentSpeakers: TurnMessageRecord[]
  pendingChoices: string[]
  pendingCharChanges: Record<string, { status?: string; is_active?: boolean }>

  isPlaying: boolean
  isAiLoading: boolean
  showChoices: boolean
  isBgTransitioning: boolean
  canRedo: boolean
  isRedoing: boolean
  hasAIError: boolean
  isLockedByOtherTab: boolean
  remoteSyncNonce: number

  initSession(record: SessionRecord): void
  applyTurnResult(result: ApplyTurnParams): void
  applyPendingCharChange(sessionCharacterId: string): void
  lockTurn(): void
  unlockTurn(): void
  resetGame(): void
}
```

Presence changes are deliberately deferred until the corresponding speaker block finishes. Other authoritative fields, including attributes, update from `TurnResponse.session_characters` immediately.

`BroadcastChannel` prevents concurrent submissions. A remote unlock increments `remoteSyncNonce`, which tells the story controller to fetch authoritative session state.

---

## usePlayerStore (`src/store/usePlayerStore.ts`) ✅

Tracks authenticated user identity, settings, and the shared credit record. Credits are hydrated during auth bootstrap and decremented optimistically only after successful turn/redo responses.

---

## useAudioStore (`src/store/useAudioStore.ts`) ✅

Tracks current BGM, music state, volume/enabled settings, text SFX configuration, and mute state. `AudioManager` owns Howler playback.
