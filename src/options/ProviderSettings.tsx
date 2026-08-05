import { useEffect, useState } from 'react'
import type { AiProviderId } from '../lib/storage'
import {
  clearStaleApiKeys,
  getActiveProvider,
  getApiKey,
  getProviderSettings,
  listProviderKeyStates,
  removeApiKey,
  saveApiKey,
  saveProviderSettings,
  setActiveProvider,
} from '../lib/storage'

const PROVIDERS: { id: AiProviderId; label: string; needsKey: boolean }[] = [
  { id: 'openai', label: 'OpenAI', needsKey: true },
  { id: 'anthropic', label: 'Anthropic', needsKey: true },
  { id: 'gemini', label: 'Google Gemini', needsKey: true },
  { id: 'ollama', label: 'Ollama (local, no key needed)', needsKey: false },
  { id: 'openai-compatible', label: 'Other (OpenAI-compatible endpoint)', needsKey: true },
]

export default function ProviderSettings() {
  const [active, setActive] = useState<AiProviderId>('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [keyStates, setKeyStates] = useState<Partial<Record<AiProviderId, 'ok' | 'stale'>>>({})
  const [needsReentry, setNeedsReentry] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    getActiveProvider().then((p) => p && setActive(p))
    listProviderKeyStates().then(setKeyStates)
  }, [])

  useEffect(() => {
    getProviderSettings(active).then((s) => {
      setModel(s.model ?? '')
      setBaseUrl(s.baseUrl ?? '')
    })
    // A stale key can't be shown or reused — surface that explicitly instead
    // of rendering an empty box that looks like nothing was ever saved.
    getApiKey(active).then((result) => {
      setApiKey(result.status === 'ok' ? result.apiKey : '')
      setNeedsReentry(result.status === 'stale')
    })
  }, [active])

  async function handleSave() {
    if (apiKey) {
      await saveApiKey(active, apiKey)
      setNeedsReentry(false)
    }
    await saveProviderSettings(active, { model: model || undefined, baseUrl: baseUrl || undefined })
    await setActiveProvider(active)
    setKeyStates(await listProviderKeyStates())
    setStatus('Saved. This provider is now active.')
  }

  async function handleRemoveKey() {
    await removeApiKey(active)
    setApiKey('')
    setNeedsReentry(false)
    setKeyStates(await listProviderKeyStates())
    setStatus('API key removed.')
  }

  async function handleClearStale() {
    const cleared = await clearStaleApiKeys()
    setKeyStates(await listProviderKeyStates())
    setNeedsReentry(false)
    setStatus(
      cleared.length > 0
        ? `Cleared unrecoverable key(s) for: ${cleared.join(', ')}. Re-enter them below.`
        : 'No unrecoverable keys to clear.',
    )
  }

  const providerInfo = PROVIDERS.find((p) => p.id === active)!

  return (
    <section>
      <h2>AI provider</h2>
      <p>
        Bring your own API key — nothing is sent anywhere except directly to the provider you
        choose below. Keys are encrypted at rest and only decryptable for the current browser
        session (they clear on browser restart, by design).
      </p>
      <label>
        Provider:{' '}
        <select value={active} onChange={(e) => setActive(e.target.value as AiProviderId)}>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {keyStates[p.id] === 'ok' ? ' (configured)' : ''}
              {keyStates[p.id] === 'stale' ? ' (needs re-entry)' : ''}
            </option>
          ))}
        </select>
      </label>
      <br />
      {needsReentry && (
        <p style={{ fontSize: 13, color: '#a00' }}>
          Your saved {providerInfo.label} key was encrypted in a previous browser session and can no
          longer be decrypted — that&apos;s expected, since the encryption key is never written to
          disk. Re-enter it below to continue.{' '}
          <button onClick={handleClearStale}>Clear unrecoverable keys</button>
        </p>
      )}
      {providerInfo.needsKey && (
        <label>
          API key: <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={{ width: 320 }} />
        </label>
      )}
      <br />
      <label>
        Model (optional): <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="uses provider default" />
      </label>
      <br />
      <label>
        Base URL (optional): <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="uses provider default" style={{ width: 320 }} />
      </label>
      <br />
      <button onClick={handleSave}>Save</button>
      {providerInfo.needsKey && <button onClick={handleRemoveKey}>Remove key</button>}
      {status && <p style={{ fontSize: 13, color: '#555' }}>{status}</p>}
    </section>
  )
}
