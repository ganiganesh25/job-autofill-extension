// LinkedIn Easy Apply renders fields inside a modal with aria-labels that
// are usually descriptive enough for the generic heuristic on their own.
// This module narrows detection to the Easy Apply modal when present, so
// fields from the surrounding page (nav, feed, etc.) aren't picked up.
import type { DetectedField } from '../types'
import { detectFields as detectGenericFields } from './generic-heuristic'

const EASY_APPLY_MODAL_SELECTOR = '.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"]'

export function detectFields(): DetectedField[] {
  const modal = document.querySelector(EASY_APPLY_MODAL_SELECTOR)
  if (!modal) return detectGenericFields()

  const fields = detectGenericFields()
  return fields.filter((field) => modal.contains(field.element))
}
