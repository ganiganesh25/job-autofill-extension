import { useEffect, useState } from 'react'
import { sendToBackground, sendToContentScript } from '../lib/messaging'
import { emptyProfile, type Profile } from '../lib/profile-schema'
import { getActiveProvider, getProfile } from '../lib/storage'
import { matchSupportedSite } from './site-support'
import type { AiProviderId } from '../lib/storage'
import type { DetectedFieldSummary } from '../types/content-messages'
import type { FieldType } from '../content/types'

type Field = DetectedFieldSummary & { index: number }

function profileValueForType(profile: Profile, type: FieldType): string | null {
  switch (type) {
    case 'fullName':
      return profile.fullName || null
    case 'firstName':
      return profile.fullName?.split(' ')[0] || null
    case 'lastName': {
      const parts = profile.fullName?.split(' ') ?? []
      return parts.length > 1 ? parts[parts.length - 1] : null
    }
    case 'email':
      return profile.email || null
    case 'phone':
      return profile.phone || null
    case 'location':
      return profile.location || null
    case 'country':
      return profile.country || null
    case 'linkedin':
      return profile.links?.linkedin || null
    case 'github':
      return profile.links?.github || null
    case 'portfolio':
      return profile.links?.portfolio || null
    default:
      return null
  }
}

function profileSummary(profile: Profile): string {
  const experience = profile.workExperience
    .map((w) => `${w.title} at ${w.company}`)
    .join('; ')
  return `${profile.fullName}. Skills: ${profile.skills.join(', ')}. Experience: ${experience}. ${profile.summary ?? ''}`
}

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null)
  const [hostname, setHostname] = useState('')
  const [permissionPattern, setPermissionPattern] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [fields, setFields] = useState<Field[]>([])
  const [profile, setProfile] = useState<Profile>(emptyProfile)
  const [provider, setProvider] = useState<AiProviderId | null>(null)
  const [matchScore, setMatchScore] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url) {
        setStatus('No active tab.')
        return
      }
      setTabId(tab.id)
      const host = new URL(tab.url).hostname
      setHostname(host)
      const pattern = matchSupportedSite(host)
      setPermissionPattern(pattern)
      if (pattern) {
        const granted = await chrome.permissions.contains({ origins: [pattern] })
        setHasPermission(granted)
        if (granted) await loadFields(tab.id)
      }
      setProfile((await getProfile<Profile>()) ?? emptyProfile)
      setProvider(await getActiveProvider())
    })()
  }, [])

  async function loadFields(id: number) {
    try {
      const summaries = await sendToContentScript<DetectedFieldSummary[]>(id, { type: 'DETECT_FIELDS' })
      setFields(summaries.map((f, index) => ({ ...f, index })))
      setStatus(`Detected ${summaries.length} field(s).`)
    } catch {
      setStatus('Could not reach this page — reload the tab and reopen this popup.')
    }
  }

  async function handleGrantPermission() {
    if (!permissionPattern) return
    const granted = await chrome.permissions.request({ origins: [permissionPattern] })
    setHasPermission(granted)
    if (granted) {
      setStatus('Permission granted — reload the page, then reopen this popup.')
    }
  }

  async function handleFillKnownFields() {
    if (!tabId) return
    setBusy(true)
    let filled = 0
    const failed: string[] = []
    try {
      for (const field of fields) {
        const value = profileValueForType(profile, field.type)
        if (!value) continue
        // One unfillable field (detached node, navigated SPA) must not abort
        // the whole run or leave `busy` stuck true — which disabled every
        // button until the popup was reopened.
        try {
          await sendToContentScript(tabId, { type: 'FILL_FIELD', index: field.index, value })
          filled++
        } catch {
          failed.push(field.label || field.type)
        }
      }
      setStatus(
        failed.length > 0
          ? `Filled ${filled} field(s); ${failed.length} failed — try Re-detect.`
          : `Filled ${filled} field(s) from your profile.`,
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerateAnswer(field: Field) {
    if (!tabId || !provider) {
      setStatus('Set an AI provider in Settings first.')
      return
    }
    setBusy(true)
    try {
      const answer = await sendToBackground<string>({
        type: 'GENERATE_ANSWER',
        provider,
        prompt: field.label || 'Tell us about yourself',
        context: profileSummary(profile),
      })
      await sendToContentScript(tabId, { type: 'FILL_FIELD', index: field.index, value: answer })
      setStatus(`Generated an answer for "${field.label}".`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleComputeMatchScore() {
    if (!tabId || !provider) {
      setStatus('Set an AI provider in Settings first.')
      return
    }
    setBusy(true)
    try {
      const pageText = await sendToContentScript<string>(tabId, { type: 'GET_PAGE_TEXT' })
      const score = await sendToBackground<number | null>({
        type: 'COMPUTE_MATCH_SCORE',
        provider,
        profileSummary: profileSummary(profile),
        jobDescription: pageText,
      })
      setMatchScore(score)
      // null means the model replied without a usable number — say so rather
      // than rendering it as a confident 0%.
      setStatus(score === null ? "The model didn't return a usable score. Try again." : '')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const openEndedFields = fields.filter((f) => f.type === 'openEnded' || f.type === 'coverLetter')

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 16, margin: '0 0 8px' }}>Job Autofill</h1>

      {!permissionPattern && hostname && (
        <p style={{ fontSize: 13, color: '#666' }}>
          {hostname} isn&apos;t a supported site yet (Greenhouse, Lever, Workday, LinkedIn only in v1).
        </p>
      )}

      {permissionPattern && !hasPermission && (
        <button onClick={handleGrantPermission}>Enable Job Autofill for {hostname}</button>
      )}

      {permissionPattern && hasPermission && (
        <>
          <p style={{ fontSize: 13 }}>
            {fields.length} field(s) detected.{' '}
            <button onClick={() => tabId && loadFields(tabId)} disabled={busy}>
              Re-detect
            </button>
          </p>
          <button onClick={handleFillKnownFields} disabled={busy || !profile.fullName}>
            Fill known fields from profile
          </button>
          {!profile.fullName && <p style={{ fontSize: 12, color: '#a00' }}>No profile saved — add one in Settings.</p>}

          <div style={{ marginTop: 12 }}>
            <button onClick={handleComputeMatchScore} disabled={busy}>
              Compute match %
            </button>
            {matchScore !== null && <span style={{ marginLeft: 8 }}>{matchScore}%</span>}
          </div>

          {openEndedFields.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Open-ended questions</p>
              {openEndedFields.map((f) => (
                <div key={f.index} style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12 }}>{f.label || '(untitled question)'}</span>{' '}
                  <button onClick={() => handleGenerateAnswer(f)} disabled={busy}>
                    Generate
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {status && <p style={{ fontSize: 12, color: '#555', marginTop: 12 }}>{status}</p>}

      {/* The popup previously had no route to the options page at all — the
          only way in was via chrome://extensions. */}
      <p style={{ marginTop: 12 }}>
        <button onClick={() => chrome.runtime.openOptionsPage()}>Open Settings</button>
      </p>
    </div>
  )
}
