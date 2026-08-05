import {
  decryptString,
  encryptString,
  getOrCreateWrappingKey,
  isStale,
  isUnlocked,
  loadWrappingKey,
  type EncryptedPayload,
} from './crypto'

export type AiProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openai-compatible'

const API_KEYS_STORAGE_KEY = 'encryptedApiKeys'
const PROFILE_STORAGE_KEY = 'profile'

type EncryptedApiKeyMap = Partial<Record<AiProviderId, EncryptedPayload>>

async function readEncryptedKeyMap(): Promise<EncryptedApiKeyMap> {
  const result = await chrome.storage.local.get(API_KEYS_STORAGE_KEY)
  return (result[API_KEYS_STORAGE_KEY] as EncryptedApiKeyMap | undefined) ?? {}
}

/** Encrypts and persists an API key for a provider. Never stores plaintext. */
export async function saveApiKey(provider: AiProviderId, apiKey: string): Promise<void> {
  const wrappingKey = await getOrCreateWrappingKey()
  const encrypted = await encryptString(apiKey, wrappingKey)
  const map = await readEncryptedKeyMap()
  map[provider] = encrypted
  await chrome.storage.local.set({ [API_KEYS_STORAGE_KEY]: map })
}

/**
 * Why this returns a status rather than `string | null`:
 *
 * "no key was ever saved" and "a key is saved but this browser session can no
 * longer decrypt it" need different UI. Collapsing both to null told the user
 * "no API key saved" for a key they had definitely saved, with no hint that
 * re-entering it was the fix — and left the undecryptable ciphertext in place
 * so the provider still showed as configured forever.
 */
export type ApiKeyResult =
  | { status: 'ok'; apiKey: string }
  /** Nothing has ever been saved for this provider. */
  | { status: 'absent' }
  /** A key is saved, but it was encrypted in a previous browser session. Re-entry required. */
  | { status: 'stale' }

/** Decrypts a provider's API key. See ApiKeyResult for the three outcomes. */
export async function getApiKey(provider: AiProviderId): Promise<ApiKeyResult> {
  const map = await readEncryptedKeyMap()
  const encrypted = map[provider]
  if (!encrypted) return { status: 'absent' }

  // Read-only: never mint a wrapping key here. Creating one would guarantee
  // the decrypt below fails and would overwrite the only key that could ever
  // have read existing ciphertext.
  const wrapping = await loadWrappingKey()
  if (isStale(encrypted, wrapping) || !wrapping) return { status: 'stale' }

  try {
    return { status: 'ok', apiKey: await decryptString(encrypted, wrapping) }
  } catch {
    // Matching keyId but undecryptable means the stored payload is corrupt.
    return { status: 'stale' }
  }
}

export async function removeApiKey(provider: AiProviderId): Promise<void> {
  const map = await readEncryptedKeyMap()
  delete map[provider]
  await chrome.storage.local.set({ [API_KEYS_STORAGE_KEY]: map })
}

/** Per-provider view of what is saved, so the UI can distinguish configured from needs-re-entry. */
export async function listProviderKeyStates(): Promise<
  Partial<Record<AiProviderId, 'ok' | 'stale'>>
> {
  const map = await readEncryptedKeyMap()
  const wrapping = await loadWrappingKey()
  const states: Partial<Record<AiProviderId, 'ok' | 'stale'>> = {}
  for (const provider of Object.keys(map) as AiProviderId[]) {
    const payload = map[provider]
    if (!payload) continue
    states[provider] = isStale(payload, wrapping) ? 'stale' : 'ok'
  }
  return states
}

export async function listConfiguredProviders(): Promise<AiProviderId[]> {
  const map = await readEncryptedKeyMap()
  return Object.keys(map) as AiProviderId[]
}

/**
 * Drops ciphertext that no longer has a matching wrapping key, so a provider
 * stops advertising itself as configured once its key is unrecoverable.
 * Returns the providers that were cleared.
 */
export async function clearStaleApiKeys(): Promise<AiProviderId[]> {
  const map = await readEncryptedKeyMap()
  const wrapping = await loadWrappingKey()
  const cleared: AiProviderId[] = []
  for (const provider of Object.keys(map) as AiProviderId[]) {
    const payload = map[provider]
    if (payload && isStale(payload, wrapping)) {
      delete map[provider]
      cleared.push(provider)
    }
  }
  if (cleared.length > 0) await chrome.storage.local.set({ [API_KEYS_STORAGE_KEY]: map })
  return cleared
}

export { isUnlocked }

// --- Profile (resume-derived data) ---
// Not a secret, so it's stored as plain JSON — same trust boundary as any
// other locally-saved browser extension data.

export async function saveProfile(profile: unknown): Promise<void> {
  await chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: profile })
}

export async function getProfile<T = unknown>(): Promise<T | null> {
  const result = await chrome.storage.local.get(PROFILE_STORAGE_KEY)
  return (result[PROFILE_STORAGE_KEY] as T | undefined) ?? null
}

// --- Provider settings (model, base URL) ---
// Non-secret configuration, stored separately from the encrypted API key map.

export interface ProviderSettings {
  model?: string
  baseUrl?: string
}

const PROVIDER_SETTINGS_STORAGE_KEY = 'providerSettings'
const ACTIVE_PROVIDER_STORAGE_KEY = 'activeProvider'

type ProviderSettingsMap = Partial<Record<AiProviderId, ProviderSettings>>

export async function saveProviderSettings(
  provider: AiProviderId,
  settings: ProviderSettings,
): Promise<void> {
  const result = await chrome.storage.local.get(PROVIDER_SETTINGS_STORAGE_KEY)
  const map = (result[PROVIDER_SETTINGS_STORAGE_KEY] as ProviderSettingsMap | undefined) ?? {}
  map[provider] = settings
  await chrome.storage.local.set({ [PROVIDER_SETTINGS_STORAGE_KEY]: map })
}

export async function getProviderSettings(provider: AiProviderId): Promise<ProviderSettings> {
  const result = await chrome.storage.local.get(PROVIDER_SETTINGS_STORAGE_KEY)
  const map = (result[PROVIDER_SETTINGS_STORAGE_KEY] as ProviderSettingsMap | undefined) ?? {}
  return map[provider] ?? {}
}

export async function setActiveProvider(provider: AiProviderId): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_PROVIDER_STORAGE_KEY]: provider })
}

export async function getActiveProvider(): Promise<AiProviderId | null> {
  const result = await chrome.storage.local.get(ACTIVE_PROVIDER_STORAGE_KEY)
  return (result[ACTIVE_PROVIDER_STORAGE_KEY] as AiProviderId | undefined) ?? null
}
