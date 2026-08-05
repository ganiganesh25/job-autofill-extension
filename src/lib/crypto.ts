// AES-GCM encryption for API keys at rest.
//
// The wrapping key lives only in chrome.storage.session, which Chrome keeps
// in memory and clears when the browser closes — it never touches disk. The
// encrypted key material persisted in chrome.storage.local is useless
// without that session key, so a copy of the profile/extension directory
// (backup, disk access, another local process) never yields plaintext keys.
//
// Because the wrapping key is regenerated per browser session, ciphertext
// written in an earlier session is permanently unrecoverable. That is the
// deliberate tradeoff for "never persist plaintext secrets to disk" — but it
// means reads must be able to tell "no key saved" apart from "a key is saved
// that this session can no longer decrypt", so the UI can prompt for
// re-entry instead of silently claiming nothing was configured. Every
// payload is stamped with the id of the wrapping key that produced it; a
// missing or mismatched id means stale, not absent.

const SESSION_KEY_STORAGE_KEY = 'wrappingKeyJwk'
const SESSION_KEY_ID_STORAGE_KEY = 'wrappingKeyId'

interface EncryptedPayload {
  iv: string // base64
  ciphertext: string // base64
  /** Id of the wrapping key that produced this payload. Absent on pre-keyId payloads. */
  keyId?: string
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

/** A wrapping key plus the id stamped into everything it encrypts. */
export interface WrappingKey {
  key: CryptoKey
  id: string
}

async function generateWrappingKey(): Promise<WrappingKey> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
  return { key, id: bufferToBase64(crypto.getRandomValues(new Uint8Array(16)).buffer) }
}

async function persistWrappingKey(wrapping: WrappingKey): Promise<void> {
  const jwk = await crypto.subtle.exportKey('jwk', wrapping.key)
  await chrome.storage.session.set({
    [SESSION_KEY_STORAGE_KEY]: jwk,
    [SESSION_KEY_ID_STORAGE_KEY]: wrapping.id,
  })
}

/**
 * Returns this session's wrapping key, or null if the session has none.
 *
 * Read paths must use this rather than getOrCreateWrappingKey — creating a
 * key during a read would mint a fresh key that cannot decrypt anything,
 * turning "locked" into a silent, permanent "no key saved".
 */
export async function loadWrappingKey(): Promise<WrappingKey | null> {
  const result = await chrome.storage.session.get([
    SESSION_KEY_STORAGE_KEY,
    SESSION_KEY_ID_STORAGE_KEY,
  ])
  const jwk = result[SESSION_KEY_STORAGE_KEY] as JsonWebKey | undefined
  const id = result[SESSION_KEY_ID_STORAGE_KEY] as string | undefined
  if (!jwk || !id) return null
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ])
  return { key, id }
}

/**
 * Returns this session's wrapping key, generating one if this is a fresh
 * session. Only write paths may call this.
 */
export async function getOrCreateWrappingKey(): Promise<WrappingKey> {
  const existing = await loadWrappingKey()
  if (existing) return existing
  const wrapping = await generateWrappingKey()
  await persistWrappingKey(wrapping)
  return wrapping
}

/** True once a wrapping key exists for this session — i.e. secrets written this session are readable. */
export async function isUnlocked(): Promise<boolean> {
  return (await loadWrappingKey()) !== null
}

/** True if this payload was written by a wrapping key this session no longer has. */
export function isStale(payload: EncryptedPayload, wrapping: WrappingKey | null): boolean {
  if (!wrapping) return true
  return payload.keyId !== wrapping.id
}

export async function encryptString(
  plaintext: string,
  wrapping: WrappingKey,
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrapping.key,
    new TextEncoder().encode(plaintext),
  )
  return {
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(ciphertext),
    keyId: wrapping.id,
  }
}

export async function decryptString(
  payload: EncryptedPayload,
  wrapping: WrappingKey,
): Promise<string> {
  const iv = new Uint8Array(base64ToBuffer(payload.iv))
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrapping.key,
    base64ToBuffer(payload.ciphertext),
  )
  return new TextDecoder().decode(plaintextBuffer)
}

export type { EncryptedPayload }
