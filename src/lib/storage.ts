import {
  decryptString,
  encryptString,
  getOrCreateWrappingKey,
  isUnlocked,
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

/** Decrypts and returns a provider's API key, or null if none is saved / session is locked. */
export async function getApiKey(provider: AiProviderId): Promise<string | null> {
  const map = await readEncryptedKeyMap()
  const encrypted = map[provider]
  if (!encrypted) return null
  const wrappingKey = await getOrCreateWrappingKey()
  try {
    return await decryptString(encrypted, wrappingKey)
  } catch {
    // Wrapping key doesn't match this ciphertext (e.g. storage from a prior
    // session was never cleared) — treat as absent rather than throwing.
    return null
  }
}

export async function removeApiKey(provider: AiProviderId): Promise<void> {
  const map = await readEncryptedKeyMap()
  delete map[provider]
  await chrome.storage.local.set({ [API_KEYS_STORAGE_KEY]: map })
}

export async function listConfiguredProviders(): Promise<AiProviderId[]> {
  const map = await readEncryptedKeyMap()
  return Object.keys(map) as AiProviderId[]
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
