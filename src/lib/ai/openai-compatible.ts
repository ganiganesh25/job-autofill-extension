// Groq, OpenRouter, local inference servers, etc. — anything speaking the
// OpenAI chat-completions wire format. Requires baseUrl to be set.
import { createOpenAiProvider } from './openai'
import type { AiProvider, ProviderConfig } from './provider'

export function createOpenAiCompatibleProvider(config: ProviderConfig): AiProvider {
  if (!config.baseUrl) {
    throw new Error('openai-compatible provider requires a baseUrl')
  }
  return createOpenAiProvider(config)
}
