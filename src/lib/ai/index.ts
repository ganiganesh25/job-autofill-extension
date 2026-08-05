import type { AiProviderId } from '../storage'
import { createAnthropicProvider } from './anthropic'
import { createGeminiProvider } from './gemini'
import { createOllamaProvider } from './ollama'
import { createOpenAiCompatibleProvider } from './openai-compatible'
import { createOpenAiProvider } from './openai'
import type { AiProvider, ProviderConfig } from './provider'

export function createProvider(id: AiProviderId, config: ProviderConfig): AiProvider {
  switch (id) {
    case 'openai':
      return createOpenAiProvider(config)
    case 'anthropic':
      return createAnthropicProvider(config)
    case 'gemini':
      return createGeminiProvider(config)
    case 'ollama':
      return createOllamaProvider(config)
    case 'openai-compatible':
      return createOpenAiCompatibleProvider(config)
  }
}

export type { AiProvider, ProviderConfig }
