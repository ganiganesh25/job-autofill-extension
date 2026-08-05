// Minimal in-memory mock of the chrome.storage API surface used by lib/,
// enough for unit tests to exercise real encrypt/decrypt round-trips without
// a browser.
import { webcrypto } from 'node:crypto'
import { vi } from 'vitest'

if (typeof globalThis.crypto === 'undefined') {
  ;(globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto
}

// jsdom does not implement CSS.escape, which the generic detector uses to
// build `label[for="..."]` selectors safely.
if (typeof globalThis.CSS === 'undefined' || typeof globalThis.CSS.escape !== 'function') {
  ;(globalThis as unknown as { CSS: { escape(value: string): string } }).CSS = {
    escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
  }
}

function makeAreaMock() {
  const store = new Map<string, unknown>()
  return {
    // chrome.storage.get accepts a single key or an array of keys.
    get: vi.fn(async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys]
      return Object.fromEntries(list.map((k) => [k, store.get(k)]))
    }),
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
