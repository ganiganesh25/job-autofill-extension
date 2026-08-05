// Lever application forms (jobs.lever.co) use a fairly stable set of
// `name` attributes for standard fields. Anything else falls back to the
// generic label-matching heuristic.
import type { DetectedField, FieldType, FillableElement } from '../types'
import { detectFields as detectGenericFields } from './generic-heuristic'

const NAME_RULES: { type: FieldType; pattern: RegExp }[] = [
  { type: 'fullName', pattern: /^name$/i },
  { type: 'email', pattern: /^email$/i },
  { type: 'phone', pattern: /^phone$/i },
  { type: 'resume', pattern: /^resume$/i },
  { type: 'linkedin', pattern: /^urls\[linkedin\]$/i },
  { type: 'github', pattern: /^urls\[github\]$/i },
  { type: 'portfolio', pattern: /^urls\[portfolio\]$/i },
]

function classifyByName(element: FillableElement): FieldType | null {
  const name = element.getAttribute('name') ?? ''
  for (const rule of NAME_RULES) {
    if (rule.pattern.test(name)) return rule.type
  }
  return null
}

export function detectFields(): DetectedField[] {
  const generic = detectGenericFields()
  return generic.map((field) => {
    const overrideType = classifyByName(field.element)
    return overrideType ? { ...field, type: overrideType } : field
  })
}
