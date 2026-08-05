// Writes values into form fields using only safe DOM APIs. Never uses
// innerHTML/outerHTML with any value here — AI-generated or job-posting text
// is untrusted and must never be interpreted as markup.
import type { FillableElement } from './types'

function dispatchInputEvents(element: FillableElement) {
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

export function setFieldValue(element: FillableElement, value: string): void {
  if (element instanceof HTMLSelectElement) {
    const option = Array.from(element.options).find(
      (o) => o.value === value || o.textContent?.trim().toLowerCase() === value.trim().toLowerCase(),
    )
    if (option) element.value = option.value
    dispatchInputEvents(element)
    return
  }

  // Use the native setter so frameworks (React etc.) that track value via a
  // property descriptor pick up the change, not just the DOM attribute.
  const prototype = Object.getPrototypeOf(element)
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor?.set?.call(element, value)
  dispatchInputEvents(element)
}
