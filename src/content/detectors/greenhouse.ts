// Greenhouse application forms (boards.greenhouse.io / job-boards.greenhouse.io)
// use fairly consistent field ids/names for the standard fields. Anything
// outside that known set (custom application questions, EEO fields, etc.)
// falls back to the generic label-matching heuristic.
import type { DetectedField, FieldType, FillableElement } from '../types'
import { detectFields as detectGenericFields } from './generic-heuristic'

const ID_RULES: { type: FieldType; pattern: RegExp }[] = [
  { type: 'firstName', pattern: /first_name/i },
  { type: 'lastName', pattern: /last_name/i },
  { type: 'email', pattern: /^email$/i },
  { type: 'phone', pattern: /^phone$/i },
  { type: 'resume', pattern: /^resume/i },
  { type: 'coverLetter', pattern: /cover_letter/i },
]

function classifyById(element: FillableElement): FieldType | null {
  const identifier = `${element.id} ${element.getAttribute('name') ?? ''}`
  for (const rule of ID_RULES) {
    if (rule.pattern.test(identifier)) return rule.type
  }
  return null
}

export function detectFields(): DetectedField[] {
  const generic = detectGenericFields()
  return generic.map((field) => {
    const overrideType = classifyById(field.element)
    return overrideType ? { ...field, type: overrideType } : field
  })
}
