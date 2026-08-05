// AES-GCM encryption for API keys at rest.
//
// The wrapping key lives only in chrome.storage.session, which Chrome keeps
// in memory and clears when the browser closes — it never touches disk. The
// encrypted key material persisted in chrome.storage.local is useless
// without that session key, so a copy of the profile/extension directory
// (backup, disk access, another local process) never yields plaintext keys.
// Restarting the browser clears the session key, so the user re-enters their
// API keys after a restart — that's the deliberate tradeoff for "never
// persist plaintext secrets to disk."

const SESSION_KEY_STORAGE_KEY = 'wrappingKeyJwk'

interface EncryptedPayload {
  iv: string // base64
  ciphertext: string // base64
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function generateWrappingKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
}

async function persistWrappingKey(key: CryptoKey): Promise<void> {
  const jwk = await crypto.subtle.exportKey('jwk', key)
  await chrome.storage.session.set({ [SESSION_KEY_STORAGE_KEY]: jwk })
}

async function loadWrappingKey(): Promise<CryptoKey | null> {
  const result = await chrome.storage.session.get(SESSION_KEY_STORAGE_KEY)
  const jwk = result[SESSION_KEY_STORAGE_KEY] as JsonWebKey | undefined
  if (!jwk) return null
  return crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ])
}

/** Returns the current session's wrapping key, generating one if this is a fresh session. */
export async function getOrCreateWrappingKey(): Promise<CryptoKey> {
  const existing = await loadWrappingKey()
  if (existing) return existing
  const key = await generateWrappingKey()
  await persistWrappingKey(key)
  return key
}

/** True once a wrapping key exists for this session — i.e. secrets can be decrypted without re-entry. */
export async function isUnlocked(): Promise<boolean> {
  return (await loadWrappingKey()) !== null
}

export async function encryptString(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return {
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(ciphertext),
  }
}

export async function decryptString(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<string> {
  const iv = new Uint8Array(base64ToBuffer(payload.iv))
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    base64ToBuffer(payload.ciphertext),
  )
  return new TextDecoder().decode(plaintextBuffer)
}

export type { EncryptedPayload }
