// Fallback detector for any site without a dedicated ATS module. Matches
// label/aria-label/placeholder text against known field-type keywords.
import type { DetectedField, FieldType, FillableElement } from '../types'

const KEYWORD_RULES: { type: FieldType; keywords: RegExp }[] = [
  { type: 'email', keywords: /\bemail\b/i },
  { type: 'phone', keywords: /\b(phone|mobile|telephone)\b/i },
  { type: 'linkedin', keywords: /linkedin/i },
  { type: 'github', keywords: /github/i },
  { type: 'portfolio', keywords: /\b(portfolio|website|personal site)\b/i },
  { type: 'firstName', keywords: /\b(first\s*name|given\s*name)\b/i },
  { type: 'lastName', keywords: /\b(last\s*name|surname|family\s*name)\b/i },
  { type: 'fullName', keywords: /\b(full\s*name|your\s*name)\b|^name$/i },
  // "address" is deliberately guarded: "Email address" is the most common
  // label on the planet and must not classify as a location. Don't rely on
  // the email rule being listed first to save this.
  {
    type: 'location',
    keywords: /\b(location|city|town|street|postcode|postal code|zip)\b|(?<!e-?mail\s)\baddress\b/i,
  },
  { type: 'coverLetter', keywords: /\b(cover\s*letter|why\s+(do\s+you|are\s+you)|why\s+this)\b/i },
]

function getLabelText(element: FillableElement): string {
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel

  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ')
    if (text) return text
  }

  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
    if (label?.textContent) return label.textContent.trim()
  }

  const wrappingLabel = element.closest('label')
  if (wrappingLabel?.textContent) return wrappingLabel.textContent.trim()

  const placeholder = 'placeholder' in element ? element.placeholder : ''
  if (placeholder) return placeholder

  return ''
}

function classify(labelText: string, element: FillableElement): FieldType {
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.test(labelText)) return rule.type
  }
  if (element instanceof HTMLTextAreaElement) return 'openEnded'
  if (element instanceof HTMLInputElement && element.type === 'file') return 'resume'
  return 'unknown'
}

function isVisible(element: Element): boolean {
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
}

const IGNORED_INPUT_TYPES = ['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio']

export function detectFields(): DetectedField[] {
  const candidates = Array.from(
    document.querySelectorAll<FillableElement>('input, textarea, select'),
  ).filter((el) => {
    if (el instanceof HTMLInputElement) {
      if (IGNORED_INPUT_TYPES.includes(el.type)) return false
      // Resume/file inputs are usually visually hidden behind a styled label,
      // so the visibility check below would wrongly discard them. (The old
      // code tried to keep them inside the ignored-types branch, where
      // type === 'file' could never be true, so they were always dropped.)
      if (el.type === 'file') return true
    }
    return isVisible(el)
  })

  return candidates.map((element) => {
    const label = getLabelText(element)
    return { element, type: classify(label, element), label }
  })
}
