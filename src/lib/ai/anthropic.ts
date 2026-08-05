import {
  buildAnswerUserPrompt,
  buildMatchScoreUserPrompt,
  buildResumeExtractionUserPrompt,
  MATCH_SCORE_SYSTEM_PROMPT,
  RESUME_EXTRACTION_SYSTEM_PROMPT,
} from './prompts'
import type { AiProvider, ProviderConfig } from './provider'

const DEFAULT_MODEL = 'claude-sonnet-5'
const ANTHROPIC_VERSION = '2023-06-01'

async function complete(config: ProviderConfig, system: string, user: string): Promise<string> {
  const baseUrl = config.baseUrl ?? 'https://api.anthropic.com/v1'
  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: config.model ?? DEFAULT_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!response.ok) {
    throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`)
  }
  const data = (await response.json()) as { content: { type: string; text?: string }[] }
  return data.content.find((block) => block.type === 'text')?.text ?? ''
}

export function createAnthropicProvider(config: ProviderConfig): AiProvider {
  return {
    async generateAnswer({ prompt, context }) {
      return complete(config, 'You write concise, first-person job application answers.', buildAnswerUserPrompt(prompt, context))
    },
    async extractProfileFromResumeText(resumeText) {
      return complete(config, RESUME_EXTRACTION_SYSTEM_PROMPT, buildResumeExtractionUserPrompt(resumeText))
    },
    async computeMatchScore({ profileSummary, jobDescription }) {
      const result = await complete(
        config,
        MATCH_SCORE_SYSTEM_PROMPT,
        buildMatchScoreUserPrompt(profileSummary, jobDescription),
      )
      const parsed = parseInt(result.trim(), 10)
      return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0
    },
  }
}
