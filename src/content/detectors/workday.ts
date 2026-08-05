// Workday's DOM structure and CSS classes are regenerated per tenant/build,
// but `data-automation-id` attributes are comparatively stable across
// Workday-hosted career sites — this is the one hook worth targeting
// specifically. Expect this to need the most ongoing maintenance of the
// four ATS detectors as Workday changes its component internals.
import type { DetectedField, FieldType, FillableElement } from '../types'
import { detectFields as detectGenericFields } from './generic-heuristic'

const AUTOMATION_ID_RULES: { type: FieldType; pattern: RegExp }[] = [
  { type: 'firstName', pattern: /firstName/i },
  { type: 'lastName', pattern: /lastName/i },
  { type: 'email', pattern: /email/i },
  { type: 'phone', pattern: /phone-number|phoneNumber/i },
  { type: 'location', pattern: /addressSection|location/i },
]

function classifyByAutomationId(element: FillableElement): FieldType | null {
  const automationId =
    element.getAttribute('data-automation-id') ??
    element.closest('[data-automation-id]')?.getAttribute('data-automation-id') ??
    ''
  for (const rule of AUTOMATION_ID_RULES) {
    if (rule.pattern.test(automationId)) return rule.type
  }
  return null
}

export function detectFields(): DetectedField[] {
  const generic = detectGenericFields()
  return generic.map((field) => {
    const overrideType = classifyByAutomationId(field.element)
    return overrideType ? { ...field, type: overrideType } : field
  })
}
