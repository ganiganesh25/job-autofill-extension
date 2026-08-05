// Shared prompt templates, kept provider-agnostic so each provider module
// only owns the wire format for its API.

export const RESUME_EXTRACTION_SYSTEM_PROMPT = `You extract structured data from resume text. Respond with ONLY a JSON object matching this shape, no markdown fences, no commentary:
{
  "fullName": string,
  "email": string,
  "phone": string (optional),
  "location": string (optional),
  "country": string (optional),
  "links": { "linkedin": string, "github": string, "portfolio": string } (optional, omit unknown fields),
  "summary": string (optional),
  "skills": string[],
  "workExperience": [{ "company": string, "title": string, "location": string, "startDate": string, "endDate": string, "description": string }],
  "education": [{ "institution": string, "degree": string, "fieldOfStudy": string, "startDate": string, "endDate": string }]
}
If a field is unknown, omit it rather than guessing.`

export function buildResumeExtractionUserPrompt(resumeText: string): string {
  return `Resume text:\n\n${resumeText}`
}

export const MATCH_SCORE_SYSTEM_PROMPT = `You compare a candidate profile against a job description and respond with ONLY an integer 0-100 representing match percentage, no other text.`

export function buildMatchScoreUserPrompt(profileSummary: string, jobDescription: string): string {
  return `Candidate profile:\n${profileSummary}\n\nJob description:\n${jobDescription}`
}

/**
 * Pulls a 0-100 score out of a model response, or null if there isn't one.
 *
 * Models routinely ignore "respond with ONLY an integer" and answer "I'd rate
 * this 85/100". parseInt on that yields NaN, and the previous `?? 0` fallback
 * rendered every such failure as a confident "0% match" — indistinguishable
 * from a genuine zero. Returning null lets the UI say it couldn't score.
 */
export function parseMatchScore(response: string): number | null {
  const match = response.match(/\d{1,3}/)
  if (!match) return null
  const value = parseInt(match[0], 10)
  if (!Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, value))
}

export function buildAnswerUserPrompt(prompt: string, context: string): string {
  return `Application question: ${prompt}\n\nCandidate context:\n${context}\n\nWrite a concise, first-person answer.`
}
