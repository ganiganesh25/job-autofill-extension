// Service worker: the only place API keys are decrypted and the only place
// network calls to AI providers happen. Content scripts and UI pages talk to
// it exclusively via chrome.runtime messages — see src/types/messages.ts.
import { createProvider } from '../lib/ai'
import { getApiKey, getProviderSettings } from '../lib/storage'
import { sanitizeForPrompt } from '../lib/sanitize'
import type { ExtensionMessage, ExtensionResponse } from '../types/messages'

chrome.runtime.onInstalled.addListener(() => {
  console.log('Job Autofill installed')
})

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  // Everything, including provider setup, runs inside this try. Anything that
  // throws before sendResponse is called leaves the message channel open and
  // the caller's await never settles — which froze the popup permanently.
  try {
    let apiKey = ''
    if (message.provider !== 'ollama') {
      const result = await getApiKey(message.provider)
      if (result.status === 'absent') {
        return {
          ok: false,
          error: `No API key saved for ${message.provider}. Add one in Settings.`,
        }
      }
      if (result.status === 'stale') {
        return {
          ok: false,
          error: `Your ${message.provider} API key was encrypted in a previous browser session and can't be decrypted. Re-enter it in Settings.`,
        }
      }
      apiKey = result.apiKey
    }

    const settings = await getProviderSettings(message.provider)
    const provider = createProvider(message.provider, { apiKey, ...settings })

    switch (message.type) {
      case 'GENERATE_ANSWER': {
        const data = await provider.generateAnswer({
          prompt: sanitizeForPrompt(message.prompt),
          context: sanitizeForPrompt(message.context),
        })
        return { ok: true, data }
      }
      case 'EXTRACT_PROFILE': {
        const data = await provider.extractProfileFromResumeText(
          sanitizeForPrompt(message.resumeText),
        )
        return { ok: true, data }
      }
      case 'COMPUTE_MATCH_SCORE': {
        const data = await provider.computeMatchScore({
          profileSummary: sanitizeForPrompt(message.profileSummary),
          jobDescription: sanitizeForPrompt(message.jobDescription),
        })
        return { ok: true, data }
      }
    }

    // Unknown message type — reply rather than falling off the end, which
    // would resolve the channel with undefined and throw in the caller.
    return { ok: false, error: `Unsupported message type: ${(message as { type: string }).type}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    // Backstop: handleMessage catches its own errors, but a rejection here
    // must still produce a response or the caller waits forever.
    .catch((error: unknown) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    }))
    .then(sendResponse)
  return true // keep the message channel open for the async response
})
