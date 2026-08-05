// Fallback detector for any site without a dedicated ATS module. Matches
// label/aria-label/placeholder text against known field-type keywords.
import type { ControlKind, DetectedField, FieldType, FillableElement } from '../types'

/**
 * Identity-field rules are anchored to the start of the label.
 *
 * Unanchored keyword matching produced real, damaging false positives on live
 * Greenhouse forms: "Please email me about future job openings" matched
 * /\bemail\b/ (the verb) and would have had the applicant's email address
 * typed into a marketing opt-in dropdown. Anchoring means a label has to be
 * *named* after the field, not merely mention it.
 */
const KEYWORD_RULES: { type: FieldType; keywords: RegExp }[] = [
  { type: 'email', keywords: /^(your |work |personal |primary |contact )?e-?mail\b/i },
  { type: 'phone', keywords: /^(your |mobile |cell |home |work )?(phone|mobile|telephone)\b/i },
  { type: 'firstName', keywords: /^(first|given)\s*name\b/i },
  { type: 'lastName', keywords: /^(last|sur|family)\s*name\b/i },
  { type: 'fullName', keywords: /^(full\s*name|name)\b/i },
  { type: 'country', keywords: /^country\b/i },
  {
    // Literal space rather than \s+: normalizeLabel has already collapsed
    // runs of whitespace, and a quantifier nested inside the optional group
    // raises the star height enough to trip eslint-plugin-security's ReDoS
    // check.
    type: 'location',
    keywords: /^(?:(?:current|home|your) )?(?:location|city|town|address|street|postcode|postal code|zip)\b/i,
  },
  { type: 'portfolio', keywords: /^(website|portfolio|personal site|url)\b/i },
  // Platform URLs are distinctive enough that a substring match is safe.
  { type: 'linkedin', keywords: /linkedin/i },
  { type: 'github', keywords: /github/i },
  { type: 'coverLetter', keywords: /^cover\s*letter\b/i },
]

/** Free-text prompts that should be answered by AI rather than filled from the profile. */
const OPEN_ENDED_HINTS = /\b(why do you|why are you|what excites|tell us|describe|explain)\b/i

/**
 * True when a label reads as a question rather than a field name.
 *
 * "…Are you willing to work from our office location 3 days per week?" matched
 * /location/ and would have had the applicant's city typed into a yes/no
 * dropdown. A trailing question mark (Greenhouse appends "*" for required) or
 * an overlong label means this is a question, so identity rules must not run.
 */
export function isQuestion(label: string): boolean {
  return /\?\s*\*?\s*$/.test(label.trim()) || label.trim().length > 80
}

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

/** Strips the required-marker asterisk and surrounding whitespace Greenhouse appends. */
function normalizeLabel(label: string): string {
  return label.replace(/\s*\*\s*$/, '').replace(/\s+/g, ' ').trim()
}

export function classify(labelText: string, element: FillableElement): FieldType {
  const label = normalizeLabel(labelText)

  // Identity rules only apply to labels that name a field. A question gets
  // answered, not autofilled.
  if (!isQuestion(label)) {
    for (const rule of KEYWORD_RULES) {
      if (rule.keywords.test(label)) return rule.type
    }
  }

  if (element instanceof HTMLTextAreaElement) {
    return /^cover\s*letter\b/i.test(label) ? 'coverLetter' : 'openEnded'
  }
  if (element instanceof HTMLInputElement && element.type === 'file') return 'resume'
  // A long free-text prompt on a plain input is still something AI can answer.
  if (OPEN_ENDED_HINTS.test(label)) return 'openEnded'
  return 'unknown'
}

/** Determines how a field must be written, independent of what it holds. */
export function controlKindOf(element: FillableElement): ControlKind {
  if (element instanceof HTMLSelectElement) return 'select'
  if (element instanceof HTMLInputElement && element.type === 'file') return 'file'
  const role = element.getAttribute('role')
  if (role === 'combobox' || element.getAttribute('aria-autocomplete') === 'list') {
    return 'combobox'
  }
  return 'text'
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
      // so the visibility check below would wrongly discard them.
      if (el.type === 'file') return true
    }
    return isVisible(el)
  })

  return candidates
    .map((element) => {
      const label = getLabelText(element)
      return {
        element,
        type: classify(label, element),
        control: controlKindOf(element),
        label: normalizeLabel(label),
      }
    })
    .filter((field) => {
      // Greenhouse pairs each combobox with an unlabelled sibling input used
      // only for native required-validation. With no label, id, or name there
      // is nothing to show the user and nothing to classify — it would only
      // inflate the field count and shift the indices the popup fills by.
      if (field.label) return true
      const el = field.element
      return Boolean(el.id || el.getAttribute('name'))
    })
}
