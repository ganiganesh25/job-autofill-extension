import { beforeEach, describe, expect, it } from 'vitest'
import { decryptString, encryptString, getOrCreateWrappingKey, isUnlocked } from './crypto'

describe('crypto', () => {
  beforeEach(async () => {
    await chrome.storage.session.clear()
  })

  it('round-trips a plaintext string through encrypt/decrypt', async () => {
    const key = await getOrCreateWrappingKey()
    const encrypted = await encryptString('sk-super-secret-key', key)
    expect(encrypted.ciphertext).not.toContain('sk-super-secret-key')
    const decrypted = await decryptString(encrypted, key)
    expect(decrypted).toBe('sk-super-secret-key')
  })

  it('reuses the same wrapping key within a session', async () => {
    const key1 = await getOrCreateWrappingKey()
    const key2 = await getOrCreateWrappingKey()
    const encrypted = await encryptString('hello', key1)
    // key2 should decrypt what key1 encrypted, proving it's the same key
    const decrypted = await decryptString(encrypted, key2)
    expect(decrypted).toBe('hello')
  })

  it('reports unlocked only after a wrapping key has been created', async () => {
    expect(await isUnlocked()).toBe(false)
    await getOrCreateWrappingKey()
    expect(await isUnlocked()).toBe(true)
  })

  it('produces different ciphertext for the same plaintext (random IV)', async () => {
    const key = await getOrCreateWrappingKey()
    const a = await encryptString('same input', key)
    const b = await encryptString('same input', key)
    expect(a.ciphertext).not.toBe(b.ciphertext)
    expect(a.iv).not.toBe(b.iv)
  })
})
