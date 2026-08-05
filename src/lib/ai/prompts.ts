// Shared prompt templates, kept provider-agnostic so each provider module
// only owns the wire format for its API.

export const RESUME_EXTRACTION_SYSTEM_PROMPT = `You extract structured data from resume text. Respond with ONLY a JSON object matching this shape, no markdown fences, no commentary:
{
  "fullName": string,
  "email": string,
  "phone": string (optional),
  "location": string (optional),
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

export function buildAnswerUserPrompt(prompt: string, context: string): string {
  return `Application question: ${prompt}\n\nCandidate context:\n${context}\n\nWrite a concise, first-person answer.`
}
