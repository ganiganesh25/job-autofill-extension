import {
  buildAnswerUserPrompt,
  buildMatchScoreUserPrompt,
  buildResumeExtractionUserPrompt,
  MATCH_SCORE_SYSTEM_PROMPT,
  parseMatchScore,
  RESUME_EXTRACTION_SYSTEM_PROMPT,
} from './prompts'
import type { AiProvider, ProviderConfig } from './provider'

const DEFAULT_MODEL = 'gemini-1.5-flash'

async function generate(config: ProviderConfig, system: string, user: string): Promise<string> {
  const baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta'
  const model = config.model ?? DEFAULT_MODEL
  const response = await fetch(
    `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
      }),
    },
  )
  if (!response.ok) {
    throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`)
  }
  const data = (await response.json()) as {
    candidates: { content: { parts: { text: string }[] } }[]
  }
  return data.candidates[0]?.content.parts.map((p) => p.text).join('') ?? ''
}

export function createGeminiProvider(config: ProviderConfig): AiProvider {
  return {
    async generateAnswer({ prompt, context }) {
      return generate(config, 'You write concise, first-person job application answers.', buildAnswerUserPrompt(prompt, context))
    },
    async extractProfileFromResumeText(resumeText) {
      return generate(config, RESUME_EXTRACTION_SYSTEM_PROMPT, buildResumeExtractionUserPrompt(resumeText))
    },
    async computeMatchScore({ profileSummary, jobDescription }) {
      const result = await generate(
        config,
        MATCH_SCORE_SYSTEM_PROMPT,
        buildMatchScoreUserPrompt(profileSummary, jobDescription),
      )
      return parseMatchScore(result)
    },
  }
}
