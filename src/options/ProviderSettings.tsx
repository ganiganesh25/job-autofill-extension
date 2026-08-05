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

interface ProviderInfo {
  id: AiProviderId
  label: string
  needsKey: boolean
  /** Where to get a key, shown inline so setup doesn't require leaving the page to guess. */
  keyUrl?: string
  defaultModel: string
  needsBaseUrl?: boolean
  hint?: string
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    needsKey: true,
    keyUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    needsKey: true,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-sonnet-5',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    needsKey: true,
    keyUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-1.5-flash',
  },
  {
    id: 'ollama',
    label: 'Ollama (local, no key needed)',
    needsKey: false,
    defaultModel: 'llama3.1',
    hint: 'Runs entirely on your machine — no resume or job data leaves the device. Requires Ollama running locally (default http://localhost:11434).',
  },
  {
    id: 'openai-compatible',
    label: 'Other (OpenAI-compatible endpoint)',
    needsKey: true,
    defaultModel: 'depends on your endpoint',
    needsBaseUrl: true,
    hint: 'For Groq, OpenRouter, or any server speaking the OpenAI chat-completions format. Base URL is required.',
  },
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
    <section className="stack">
      <div className="stack-sm">
        <h2>Step 1 — AI provider</h2>
        <p className="muted">
          Bring your own API key. Requests go straight from your browser to the provider you pick —
          there is no server in between. Keys are encrypted at rest and only decryptable for the
          current browser session, so you re-enter them after a browser restart by design.
        </p>
      </div>

      <div className="field">
        <label htmlFor="provider">Provider</label>
        <select
          id="provider"
          value={active}
          onChange={(e) => setActive(e.target.value as AiProviderId)}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {keyStates[p.id] === 'ok' ? ' — configured' : ''}
              {keyStates[p.id] === 'stale' ? ' — needs re-entry' : ''}
            </option>
          ))}
        </select>
      </div>

      {providerInfo.hint && <p className="notice">{providerInfo.hint}</p>}

      {needsReentry && (
        <div className="notice danger stack-sm">
          <span>
            Your saved {providerInfo.label} key was encrypted in a previous browser session and can
            no longer be decrypted — expected, since the encryption key is never written to disk.
            Re-enter it below.
          </span>
          <div>
            <button onClick={handleClearStale}>Clear unrecoverable keys</button>
          </div>
        </div>
      )}

      {providerInfo.needsKey && (
        <div className="field">
          <label htmlFor="apikey">
            API key
            {providerInfo.keyUrl && (
              <>
                {' — '}
                <a href={providerInfo.keyUrl} target="_blank" rel="noreferrer">
                  get one here
                </a>
              </>
            )}
          </label>
          <input
            id="apikey"
            type="password"
            autoComplete="off"
            placeholder={needsReentry ? 'Re-enter your key' : 'Paste your API key'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="model">Model (optional)</label>
        <input
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={`default: ${providerInfo.defaultModel}`}
        />
      </div>

      <div className="field">
        <label htmlFor="baseurl">
          Base URL {providerInfo.needsBaseUrl ? '(required)' : '(optional)'}
        </label>
        <input
          id="baseurl"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={
            providerInfo.needsBaseUrl
              ? 'https://your-endpoint.example/v1'
              : 'uses provider default'
          }
        />
      </div>

      <div className="row">
        <button className="primary" onClick={handleSave}>
          Save
        </button>
        {providerInfo.needsKey && <button onClick={handleRemoveKey}>Remove key</button>}
      </div>

      {status && <p className="faint">{status}</p>}
    </section>
  )
}
