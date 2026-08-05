import type { ContentMessage, ContentResponse } from '../types/content-messages'
import type { ExtensionMessage, ExtensionResponse } from '../types/messages'

/** Sends a message to the background service worker and unwraps the typed response. */
export async function sendToBackground<T>(message: ExtensionMessage): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as ExtensionResponse<T>
  if (!response.ok) throw new Error(response.error)
  return response.data
}

/** Sends a message to the content script running in a specific tab and unwraps the typed response. */
export async function sendToContentScript<T>(tabId: number, message: ContentMessage): Promise<T> {
  const response = (await chrome.tabs.sendMessage(tabId, message)) as ContentResponse
  if (!response.ok) throw new Error(response.error)
  return response.data as T
}
