// Local/self-hosted inference via Ollama. No API key required — the field
// is accepted for interface consistency but ignored. All requests stay on
// the user's machine (default http://localhost:11434), so this is the only
// provider where resume/profile data never leaves the device at all.
import {
  buildAnswerUserPrompt,
  buildMatchScoreUserPrompt,
  buildResumeExtractionUserPrompt,
  MATCH_SCORE_SYSTEM_PROMPT,
  RESUME_EXTRACTION_SYSTEM_PROMPT,
} from './prompts'
import type { AiProvider, ProviderConfig } from './provider'

const DEFAULT_MODEL = 'llama3.1'
const DEFAULT_BASE_URL = 'http://localhost:11434'

async function chat(config: ProviderConfig, system: string, user: string): Promise<string> {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model ?? DEFAULT_MODEL,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`)
  }
  const data = (await response.json()) as { message: { content: string } }
  return data.message.content
}

export function createOllamaProvider(config: ProviderConfig): AiProvider {
  return {
    async generateAnswer({ prompt, context }) {
      return chat(config, 'You write concise, first-person job application answers.', buildAnswerUserPrompt(prompt, context))
    },
    async extractProfileFromResumeText(resumeText) {
      return chat(config, RESUME_EXTRACTION_SYSTEM_PROMPT, buildResumeExtractionUserPrompt(resumeText))
    },
    async computeMatchScore({ profileSummary, jobDescription }) {
      const result = await chat(
        config,
        MATCH_SCORE_SYSTEM_PROMPT,
        buildMatchScoreUserPrompt(profileSummary, jobDescription),
      )
      const parsed = parseInt(result.trim(), 10)
      return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0
    },
  }
}
