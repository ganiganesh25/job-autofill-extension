// Minimal in-memory mock of the chrome.storage API surface used by lib/,
// enough for unit tests to exercise real encrypt/decrypt round-trips without
// a browser.
import { webcrypto } from 'node:crypto'
import { vi } from 'vitest'

if (typeof globalThis.crypto === 'undefined') {
  ;(globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto
}

function makeAreaMock() {
  const store = new Map<string, unknown>()
  return {
    get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) store.set(k, v)
    }),
    remove: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(async () => store.clear()),
  }
}

;(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    session: makeAreaMock(),
    local: makeAreaMock(),
  },
}
