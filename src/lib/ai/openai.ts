import {
  buildAnswerUserPrompt,
  buildMatchScoreUserPrompt,
  buildResumeExtractionUserPrompt,
  MATCH_SCORE_SYSTEM_PROMPT,
  parseMatchScore,
  RESUME_EXTRACTION_SYSTEM_PROMPT,
} from './prompts'
import type { AiProvider, ProviderConfig } from './provider'

const DEFAULT_MODEL = 'gpt-4o-mini'

async function chat(config: ProviderConfig, system: string, user: string): Promise<string> {
  const baseUrl = config.baseUrl ?? 'https://api.openai.com/v1'
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model ?? DEFAULT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`)
  }
  const data = (await response.json()) as {
    choices: { message: { content: string } }[]
  }
  return data.choices[0]?.message.content ?? ''
}

export function createOpenAiProvider(config: ProviderConfig): AiProvider {
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
      return parseMatchScore(result)
    },
  }
}
