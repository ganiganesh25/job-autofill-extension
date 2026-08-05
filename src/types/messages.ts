// chrome.runtime message contract between content scripts / UI pages and the
// background service worker. Content scripts only ever send these — they
// never call fetch() or touch API keys directly.
import type { AiProviderId } from '../lib/storage'

export type ExtensionMessage =
  | { type: 'GENERATE_ANSWER'; provider: AiProviderId; prompt: string; context: string }
  | { type: 'EXTRACT_PROFILE'; provider: AiProviderId; resumeText: string }
  | { type: 'COMPUTE_MATCH_SCORE'; provider: AiProviderId; profileSummary: string; jobDescription: string }

export type ExtensionResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string }
