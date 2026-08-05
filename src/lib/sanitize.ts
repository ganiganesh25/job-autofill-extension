// Job descriptions, resume text, and AI responses are all untrusted input:
// a malicious job posting or a crafted resume file could try to inject
// instructions into a prompt, or scriptable content into the DOM. These
// helpers enforce that boundary at the two places it matters.

/** Strips control characters and clamps length before interpolating untrusted text into a prompt. */
export function sanitizeForPrompt(text: string, maxLength = 20_000): string {
  let stripped = ''
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    const isControlChar = (code <= 8) || (code >= 11 && code <= 12) || (code >= 14 && code <= 31) || code === 127
    if (!isControlChar) stripped += char
  }
  return stripped.slice(0, maxLength)
}

/** Escapes text for safe insertion as literal content (never used with innerHTML — inputs are always set via .value). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
