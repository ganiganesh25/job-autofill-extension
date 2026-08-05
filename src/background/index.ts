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
  const apiKey = message.provider === 'ollama' ? '' : await getApiKey(message.provider)
  if (message.provider !== 'ollama' && !apiKey) {
    return { ok: false, error: `No API key saved for ${message.provider}. Add one in Settings.` }
  }
  const settings = await getProviderSettings(message.provider)
  const provider = createProvider(message.provider, { apiKey: apiKey ?? '', ...settings })

  try {
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
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse)
  return true // keep the message channel open for the async response
})
