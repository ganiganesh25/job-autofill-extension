// Writes values into form fields using only safe DOM APIs. Never uses
// innerHTML/outerHTML with any value here — AI-generated or job-posting text
// is untrusted and must never be interpreted as markup.
import type { DetectedField, FillableElement } from './types'

function dispatchInputEvents(element: FillableElement) {
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Writes through the native value setter so frameworks (React etc.) that track
 * value via a property descriptor pick up the change, not just the DOM
 * attribute.
 */
function setNativeValue(element: FillableElement, value: string): void {
  const prototype = Object.getPrototypeOf(element)
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor?.set?.call(element, value)
}

function fillSelect(element: HTMLSelectElement, value: string): boolean {
  const option = Array.from(element.options).find(
    (o) => o.value === value || o.textContent?.trim().toLowerCase() === value.trim().toLowerCase(),
  )
  if (!option) return false
  element.value = option.value
  dispatchInputEvents(element)
  return true
}

const OPTION_SELECTOR = '[role="option"]'

/** Finds the listbox a combobox controls, falling back to a document-wide search. */
function optionsFor(element: HTMLInputElement): HTMLElement[] {
  const controlled =
    element.getAttribute('aria-controls') ?? element.getAttribute('aria-owns') ?? ''
  const listbox = controlled ? document.getElementById(controlled) : null
  const scope: ParentNode = listbox ?? document
  return Array.from(scope.querySelectorAll<HTMLElement>(OPTION_SELECTOR))
}

function waitForOptions(element: HTMLInputElement, timeoutMs: number): Promise<HTMLElement[]> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs
    const poll = () => {
      const options = optionsFor(element)
      if (options.length > 0) return resolve(options)
      if (Date.now() >= deadline) return resolve([])
      setTimeout(poll, 50)
    }
    poll()
  })
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Drives a combobox the way a user would: focus, type, wait for the listbox,
 * click a real option.
 *
 * Setting `.value` on one of these appears to work but never updates the
 * widget's internal state, so the typed text is silently discarded on submit.
 * If no option matches we restore the field rather than leaving stray text in
 * a control that will fail validation.
 */
async function fillCombobox(element: HTMLInputElement, value: string): Promise<boolean> {
  const original = element.value
  element.focus()
  element.click()
  setNativeValue(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))

  const options = await waitForOptions(element, 2000)
  const wanted = normalize(value)
  const match =
    options.find((o) => normalize(o.textContent ?? '') === wanted) ??
    options.find((o) => normalize(o.textContent ?? '').startsWith(wanted))

  if (!match) {
    setNativeValue(element, original)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.blur()
    return false
  }

  match.click()
  dispatchInputEvents(element)
  return true
}

/**
 * Fills a detected field. Returns false when the value could not be applied —
 * an unmatched combobox option, or a file input, which cannot be set
 * programmatically without the original File.
 */
export async function setFieldValue(field: DetectedField, value: string): Promise<boolean> {
  const element = field.element

  switch (field.control) {
    case 'select':
      return element instanceof HTMLSelectElement ? fillSelect(element, value) : false
    case 'combobox':
      return element instanceof HTMLInputElement ? fillCombobox(element, value) : false
    case 'file':
      // Attaching a file needs the original File object, which the extension
      // does not retain — only the text extracted from it.
      return false
    case 'text':
    default:
      setNativeValue(element, value)
      dispatchInputEvents(element)
      return true
  }
}
