// chrome.tabs.sendMessage contract between the popup and a content script.
// Distinct from types/messages.ts, which covers UI <-> background worker.
import type { FieldType } from '../content/types'

export type ContentMessage =
  | { type: 'DETECT_FIELDS' }
  | { type: 'FILL_FIELD'; index: number; value: string }
  | { type: 'GET_PAGE_TEXT' }

export interface DetectedFieldSummary {
  type: FieldType
  label: string
}

export type ContentResponse =
  | { ok: true; data: DetectedFieldSummary[] }
  | { ok: true; data: string }
  | { ok: true; data: null }
  | { ok: false; error: string }
