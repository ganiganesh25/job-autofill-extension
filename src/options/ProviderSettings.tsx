import { useEffect, useState } from 'react'
import type { AiProviderId } from '../lib/storage'
import {
  getActiveProvider,
  getApiKey,
  getProviderSettings,
  listConfiguredProviders,
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
  const [configured, setConfigured] = useState<AiProviderId[]>([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    getActiveProvider().then((p) => p && setActive(p))
    listConfiguredProviders().then(setConfigured)
  }, [])

  useEffect(() => {
    getProviderSettings(active).then((s) => {
      setModel(s.model ?? '')
      setBaseUrl(s.baseUrl ?? '')
    })
    getApiKey(active).then((k) => setApiKey(k ?? ''))
  }, [active])

  async function handleSave() {
    if (apiKey) await saveApiKey(active, apiKey)
    await saveProviderSettings(active, { model: model || undefined, baseUrl: baseUrl || undefined })
    await setActiveProvider(active)
    setConfigured(await listConfiguredProviders())
    setStatus('Saved. This provider is now active.')
  }

  async function handleRemoveKey() {
    await removeApiKey(active)
    setApiKey('')
    setConfigured(await listConfiguredProviders())
    setStatus('API key removed.')
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
              {configured.includes(p.id) ? ' (configured)' : ''}
            </option>
          ))}
        </select>
      </label>
      <br />
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
