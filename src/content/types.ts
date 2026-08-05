export type FieldType =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'location'
  | 'country'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'resume'
  | 'coverLetter'
  | 'openEnded'
  | 'unknown'

export type FillableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

/**
 * How a field has to be written, which is not the same thing as what it holds.
 *
 * Greenhouse renders every dropdown as `input[type=text][role=combobox]`, so
 * the tag name alone says nothing about how to fill it. Writing `.value` into
 * one of those never updates the widget's internal state — the typed text is
 * discarded on submit. Comboboxes have to be driven: type, wait for the
 * listbox, click a real option.
 */
export type ControlKind = 'text' | 'combobox' | 'select' | 'file'

export interface DetectedField {
  element: FillableElement
  type: FieldType
  control: ControlKind
  /** Human-readable label text used both for display and for AI prompt context. */
  label: string
}
