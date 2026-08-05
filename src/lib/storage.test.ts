import { beforeEach, describe, expect, it } from 'vitest'
import { getApiKey, listConfiguredProviders, removeApiKey, saveApiKey } from './storage'

describe('storage: API keys', () => {
  beforeEach(async () => {
    await chrome.storage.session.clear()
    await chrome.storage.local.clear()
  })

  it('saves and retrieves a decrypted API key', async () => {
    await saveApiKey('openai', 'sk-test-123')
    expect(await getApiKey('openai')).toBe('sk-test-123')
  })

  it('never stores the plaintext key in chrome.storage.local', async () => {
    await saveApiKey('anthropic', 'sk-ant-secret')
    const raw = await chrome.storage.local.get('encryptedApiKeys')
    expect(JSON.stringify(raw)).not.toContain('sk-ant-secret')
  })

  it('returns null for a provider with no saved key', async () => {
    expect(await getApiKey('gemini')).toBeNull()
  })

  it('removes a saved key', async () => {
    await saveApiKey('openai', 'sk-test-123')
    await removeApiKey('openai')
    expect(await getApiKey('openai')).toBeNull()
  })

  it('lists configured providers', async () => {
    await saveApiKey('openai', 'sk-a')
    await saveApiKey('ollama', 'unused-but-consistent')
    expect(await listConfiguredProviders()).toEqual(
      expect.arrayContaining(['openai', 'ollama']),
    )
  })
})
