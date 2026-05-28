import '@testing-library/jest-dom/vitest'

class MockBroadcastChannel {
  onmessage: ((event: MessageEvent) => void) | null = null
  constructor(name: string) { void name }
  postMessage() {}
  close() {}
}

Object.defineProperty(globalThis, 'BroadcastChannel', {
  value: MockBroadcastChannel,
  configurable: true,
})
