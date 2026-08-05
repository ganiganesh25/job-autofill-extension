// Common interface every AI provider module implements. Only the background
// service worker calls these — API keys and network access never reach
// content scripts or the page context.

export interface AiProvider {
  /** Generates a free-text answer (cover letter blurb, "why this company", etc). */
  generateAnswer(params: { prompt: string; context: string }): Promise<string>

  /** Extracts a structured profile (matching profile-schema.ts) from raw resume text. */
  extractProfileFromResumeText(resumeText: string): Promise<string> // returns raw JSON string

  /** Returns a 0-100 match score, or null if the model's reply contained no usable number. */
  computeMatchScore(params: {
    profileSummary: string
    jobDescription: string
  }): Promise<number | null>
}

export interface ProviderConfig {
  apiKey: string
  model?: string
  baseUrl?: string // used by ollama / openai-compatible
}
