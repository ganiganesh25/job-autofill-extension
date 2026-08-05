export type FieldType =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'location'
  | 'linkedin'
  | 'github'
  | 'portfolio'
  | 'resume'
  | 'coverLetter'
  | 'openEnded'
  | 'unknown'

export type FillableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

export interface DetectedField {
  element: FillableElement
  type: FieldType
  /** Human-readable label text used both for display and for AI prompt context. */
  label: string
}
