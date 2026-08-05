// Injected only on domains the user has granted optional host permission for
// (see manifest.config.ts). Detects form fields and fills them via safe DOM
// APIs (fill.ts) — never makes network calls or handles API keys directly;
// all AI calls go through the background service worker via messaging.ts.
import type { ContentMessage, ContentResponse } from '../types/content-messages'
import { detectFields as detectGreenhouseFields } from './detectors/greenhouse'
import { detectFields as detectGenericFields } from './detectors/generic-heuristic'
import { detectFields as detectLeverFields } from './detectors/lever'
import { detectFields as detectLinkedinFields } from './detectors/linkedin'
import { detectFields as detectWorkdayFields } from './detectors/workday'
import { setFieldValue } from './fill'
import type { DetectedField } from './types'

let lastDetectedFields: DetectedField[] = []

function detectFieldsForCurrentSite(): DetectedField[] {
  const host = location.hostname
  if (host.endsWith('greenhouse.io')) return detectGreenhouseFields()
  if (host.endsWith('lever.co')) return detectLeverFields()
  if (host.endsWith('myworkdayjobs.com')) return detectWorkdayFields()
  if (host.endsWith('linkedin.com')) return detectLinkedinFields()
  return detectGenericFields()
}

chrome.runtime.onMessage.addListener(
  (message: ContentMessage, _sender, sendResponse: (response: ContentResponse) => void) => {
    switch (message.type) {
      case 'DETECT_FIELDS': {
        lastDetectedFields = detectFieldsForCurrentSite()
        sendResponse({
          ok: true,
          data: lastDetectedFields.map((f) => ({ type: f.type, label: f.label })),
        })
        return true
      }
      case 'FILL_FIELD': {
        const field = lastDetectedFields[message.index]
        if (!field) {
          sendResponse({ ok: false, error: 'Field index out of range — re-detect fields.' })
          return true
        }
        // Workday and LinkedIn Easy Apply are SPAs with multi-step wizards:
        // the element captured at detection time may have been torn out of
        // the DOM since. Writing to a detached node silently succeeds and
        // fills nothing, so check before writing.
        if (!field.element.isConnected) {
          sendResponse({
            ok: false,
            error: 'The page changed since fields were detected — re-detect and try again.',
          })
          return true
        }
        setFieldValue(field.element, message.value)
        sendResponse({ ok: true, data: null })
        return true
      }
      case 'GET_PAGE_TEXT': {
        sendResponse({ ok: true, data: document.body.innerText })
        return true
      }
    }
    return undefined
  },
)
