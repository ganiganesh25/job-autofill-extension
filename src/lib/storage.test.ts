import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearStaleApiKeys,
  getApiKey,
  listProviderKeyStates,
  removeApiKey,
  saveApiKey,
} from './storage'

/** Simulates a browser restart: session storage is wiped, local storage persists. */
async function restartBrowser() {
  await chrome.storage.session.clear()
}

describe('storage: API keys', () => {
  beforeEach(async () => {
    await chrome.storage.session.clear()
    await chrome.storage.local.clear()
  })

  it('saves and retrieves a decrypted API key', async () => {
    await saveApiKey('openai', 'sk-test-123')
    expect(await getApiKey('openai')).toEqual({ status: 'ok', apiKey: 'sk-test-123' })
  })

  it('never stores the plaintext key in chrome.storage.local', async () => {
    await saveApiKey('anthropic', 'sk-ant-secret')
    const raw = await chrome.storage.local.get('encryptedApiKeys')
    expect(JSON.stringify(raw)).not.toContain('sk-ant-secret')
  })

  it('reports absent for a provider with no saved key', async () => {
    expect(await getApiKey('gemini')).toEqual({ status: 'absent' })
  })

  it('removes a saved key', async () => {
    await saveApiKey('openai', 'sk-test-123')
    await removeApiKey('openai')
    expect(await getApiKey('openai')).toEqual({ status: 'absent' })
  })

  it('lists per-provider key states', async () => {
    await saveApiKey('openai', 'sk-a')
    await saveApiKey('ollama', 'unused-but-consistent')
    expect(await listProviderKeyStates()).toEqual({ openai: 'ok', ollama: 'ok' })
  })
})

// Regression tests for the bug where reading a key after a browser restart
// minted a fresh wrapping key, permanently destroying the stored ciphertext
// while the UI kept reporting the provider as configured.
describe('storage: API keys across a browser restart', () => {
  beforeEach(async () => {
    await chrome.storage.session.clear()
    await chrome.storage.local.clear()
  })

  it('reports stale, not absent, for a key from a previous session', async () => {
    await saveApiKey('openai', 'sk-secret')
    await restartBrowser()
    expect(await getApiKey('openai')).toEqual({ status: 'stale' })
  })

  it('does not mint a wrapping key on read', async () => {
    await saveApiKey('openai', 'sk-secret')
    await restartBrowser()
    await getApiKey('openai')
    const session = await chrome.storage.session.get('wrappingKeyJwk')
    expect(session.wrappingKeyJwk).toBeUndefined()
  })

  it('surfaces a stale key in the provider list rather than claiming it is configured', async () => {
    await saveApiKey('openai', 'sk-secret')
    await restartBrowser()
    expect(await listProviderKeyStates()).toEqual({ openai: 'stale' })
  })

  it('recovers when the user re-enters the key', async () => {
    await saveApiKey('openai', 'sk-secret')
    await restartBrowser()
    await saveApiKey('openai', 'sk-secret-again')
    expect(await getApiKey('openai')).toEqual({ status: 'ok', apiKey: 'sk-secret-again' })
    expect(await listProviderKeyStates()).toEqual({ openai: 'ok' })
  })

  it('clears unrecoverable ciphertext on request', async () => {
    await saveApiKey('openai', 'sk-secret')
    await restartBrowser()
    expect(await clearStaleApiKeys()).toEqual(['openai'])
    expect(await getApiKey('openai')).toEqual({ status: 'absent' })
  })

  it('leaves keys from the current session alone when clearing stale ones', async () => {
    await saveApiKey('openai', 'sk-old')
    await restartBrowser()
    await saveApiKey('anthropic', 'sk-new')
    expect(await clearStaleApiKeys()).toEqual(['openai'])
    expect(await getApiKey('anthropic')).toEqual({ status: 'ok', apiKey: 'sk-new' })
  })
})
