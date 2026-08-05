import { useEffect, useMemo, useState } from 'react'
import '../styles.css'
import { sendToBackground, sendToContentScript } from '../lib/messaging'
import { computeLocalMatch, type MatchResult } from '../lib/match-score'
import { emptyProfile, type Profile } from '../lib/profile-schema'
import { getActiveProvider, getProfile } from '../lib/storage'
import { isAnswerable, previewValue, profileSummary, profileValueForType } from './field-values'
import { FieldRow } from './FieldRow'
import { matchSupportedSite } from './site-support'
import type { AiProviderId } from '../lib/storage'
import type { DetectedFieldSummary } from '../types/content-messages'

export type Field = DetectedFieldSummary & { index: number }

/** Per-field outcome of the last fill, keyed by field index. */
export type FillOutcome = 'filled' | 'failed'

type Status = { tone: 'ok' | 'error' | 'info'; text: string } | null

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null)
  const [hostname, setHostname] = useState('')
  const [permissionPattern, setPermissionPattern] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [fields, setFields] = useState<Field[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [outcomes, setOutcomes] = useState<Record<number, FillOutcome>>({})
  const [profile, setProfile] = useState<Profile>(emptyProfile)
  const [provider, setProvider] = useState<AiProviderId | null>(null)
  const [match, setMatch] = useState<MatchResult | null>(null)
  const [draft, setDraft] = useState<{ field: Field; text: string } | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url) {
        setStatus({ tone: 'error', text: 'No active tab.' })
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
      const summaries = await sendToContentScript<DetectedFieldSummary[]>(id, {
        type: 'DETECT_FIELDS',
      })
      const next = summaries.map((f, index) => ({ ...f, index }))
      setFields(next)
      setOutcomes({})
      setStatus(null)
      return next
    } catch {
      setStatus({
        tone: 'error',
        text: 'Could not reach this page — reload the tab and reopen this popup.',
      })
      return []
    }
  }

  // Everything the profile can fill, paired with the value that would be
  // written. Computing this up front is what lets the list preview the result
  // before anything touches the page.
  const fillable = useMemo(
    () =>
      fields
        .map((field) => ({ field, value: profileValueForType(profile, field.type) }))
        .filter((row): row is { field: Field; value: string } => row.value !== null),
    [fields, profile],
  )

  const answerable = useMemo(() => fields.filter((f) => isAnswerable(f.type)), [fields])

  // Default every fillable field to selected once detection lands. `fillable`
  // is memoized on [fields, profile], so this re-runs when detection or the
  // profile changes — not when the user toggles a checkbox.
  useEffect(() => {
    setSelected(new Set(fillable.map((r) => r.field.index)))
  }, [fillable])

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function handleGrantPermission() {
    if (!permissionPattern) return
    const granted = await chrome.permissions.request({ origins: [permissionPattern] })
    setHasPermission(granted)
    if (granted) {
      setStatus({ tone: 'info', text: 'Permission granted — reload the page, then reopen this popup.' })
    }
  }

  async function handleFillSelected() {
    if (!tabId) return
    setBusy(true)
    const results: Record<number, FillOutcome> = {}
    try {
      for (const { field, value } of fillable) {
        if (!selected.has(field.index)) continue
        try {
          await sendToContentScript(tabId, { type: 'FILL_FIELD', index: field.index, value })
          results[field.index] = 'filled'
        } catch {
          results[field.index] = 'failed'
        }
      }
      setOutcomes(results)
      // Drop what succeeded from the selection so the action button reflects
      // what is still outstanding rather than re-offering finished work.
      setSelected((prev) => {
        const next = new Set(prev)
        for (const [index, outcome] of Object.entries(results)) {
          if (outcome === 'filled') next.delete(Number(index))
        }
        return next
      })
      const filled = Object.values(results).filter((r) => r === 'filled').length
      const failed = Object.values(results).length - filled
      setStatus(
        failed > 0
          ? { tone: 'error', text: `Filled ${filled}. ${failed} could not be filled — see the list.` }
          : { tone: 'ok', text: `Filled ${filled} field${filled === 1 ? '' : 's'}.` },
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleRetry(field: Field) {
    if (!tabId) return
    const row = fillable.find((r) => r.field.index === field.index)
    if (!row) return
    setBusy(true)
    try {
      await sendToContentScript(tabId, { type: 'FILL_FIELD', index: field.index, value: row.value })
      setOutcomes((prev) => ({ ...prev, [field.index]: 'filled' }))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(field.index)
        return next
      })
      setStatus({ tone: 'ok', text: `Filled "${field.label}".` })
    } catch (error) {
      setOutcomes((prev) => ({ ...prev, [field.index]: 'failed' }))
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  // Answers are drafted into the popup, never written straight into the
  // application. Insertion requires an explicit confirmation below.
  async function handleGenerateAnswer(field: Field) {
    if (!provider) {
      setStatus({ tone: 'error', text: 'Set an AI provider in Settings first.' })
      return
    }
    setBusy(true)
    setDraft({ field, text: '' })
    try {
      const answer = await sendToBackground<string>({
        type: 'GENERATE_ANSWER',
        provider,
        prompt: field.label || 'Tell us about yourself',
        context: profileSummary(profile),
      })
      setDraft({ field, text: answer })
      setStatus({ tone: 'info', text: 'Review the draft before inserting it.' })
    } catch (error) {
      setDraft(null)
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  async function handleInsertDraft() {
    if (!tabId || !draft) return
    setBusy(true)
    try {
      await sendToContentScript(tabId, {
        type: 'FILL_FIELD',
        index: draft.field.index,
        value: draft.text,
      })
      setOutcomes((prev) => ({ ...prev, [draft.field.index]: 'filled' }))
      setStatus({ tone: 'ok', text: `Inserted into "${draft.field.label}".` })
      setDraft(null)
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  // No provider, no key, no network — see lib/match-score.ts.
  async function handleComputeMatch() {
    if (!tabId) return
    setBusy(true)
    try {
      const pageText = await sendToContentScript<string>(tabId, { type: 'GET_PAGE_TEXT' })
      setMatch(computeLocalMatch(profile.skills, profileSummary(profile), pageText))
      setStatus(null)
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const selectedCount = fillable.filter((r) => selected.has(r.field.index)).length
  const hasProfile = Boolean(profile.fullName)

  return (
    <div className="popup stack">
      <div className="row-between">
        <h1>Job Autofill</h1>
        {busy && <div className="spinner" aria-label="Working" />}
      </div>

      {!permissionPattern && hostname && (
        <p className="notice">
          <strong>{hostname}</strong> isn&apos;t a supported site yet — Greenhouse, Lever, Workday
          and LinkedIn Easy Apply are supported so far.
        </p>
      )}

      {permissionPattern && !hasPermission && (
        <>
          <p className="notice">
            Job Autofill needs permission for this site before it can read the application form.
            Nothing runs on {hostname} until you allow it.
          </p>
          <button className="primary block" onClick={handleGrantPermission}>
            Enable for {hostname}
          </button>
        </>
      )}

      {permissionPattern && hasPermission && (
        <>
          <div className="row-between">
            <span className="faint summary">
              {fields.length} fields · {fillable.length} fillable · {answerable.length} question
              {answerable.length === 1 ? '' : 's'}
            </span>
            <button className="subtle nowrap" onClick={() => tabId && loadFields(tabId)} disabled={busy}>
              Re-detect
            </button>
          </div>

          {!hasProfile && (
            <div className="notice danger stack-sm">
              <span>No profile saved yet — there&apos;s nothing to fill with.</span>
              <div>
                <button onClick={() => chrome.runtime.openOptionsPage()}>Add your profile</button>
              </div>
            </div>
          )}

          {hasProfile && fillable.length > 0 && (
            <section className="stack-sm">
              <h2>Will be filled</h2>
              <div className="card list">
                {fillable.map(({ field, value }) => (
                  <FieldRow
                    key={field.index}
                    field={field}
                    value={previewValue(field.type, value)}
                    checked={selected.has(field.index)}
                    outcome={outcomes[field.index]}
                    disabled={busy}
                    onToggle={() => toggle(field.index)}
                    onRetry={() => handleRetry(field)}
                  />
                ))}
              </div>
              <button
                className="primary block"
                onClick={handleFillSelected}
                disabled={busy || selectedCount === 0}
              >
                {selectedCount === 0
                  ? 'Nothing selected'
                  : `Fill ${selectedCount} field${selectedCount === 1 ? '' : 's'}`}
              </button>
            </section>
          )}

          {answerable.length > 0 && (
            <section className="stack-sm">
              <h2>Questions</h2>
              <div className="card list">
                {answerable.map((f) => (
                  <div className="question" key={f.index}>
                    <span className="question-label">{f.label || '(untitled question)'}</span>
                    <button onClick={() => handleGenerateAnswer(f)} disabled={busy}>
                      {outcomes[f.index] === 'filled' ? 'Redraft' : 'Draft'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {draft && (
            <section className="stack-sm">
              <h2>Draft — not inserted yet</h2>
              <p className="faint">{draft.field.label}</p>
              <textarea
                rows={7}
                value={draft.text}
                placeholder={busy ? 'Generating…' : ''}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              />
              <div className="row">
                <button
                  className="primary"
                  onClick={handleInsertDraft}
                  disabled={busy || !draft.text.trim()}
                >
                  Insert into form
                </button>
                <button onClick={() => handleGenerateAnswer(draft.field)} disabled={busy}>
                  Regenerate
                </button>
                <button className="subtle" onClick={() => setDraft(null)} disabled={busy}>
                  Discard
                </button>
              </div>
            </section>
          )}

          <section className="stack-sm">
            <div className="row-between">
              <button onClick={handleComputeMatch} disabled={busy || profile.skills.length === 0}>
                Match this posting
              </button>
              {match && <span className="pill accent">{match.score}%</span>}
            </div>
            {match && (
              <div className="card stack-sm">
                {match.matched.length > 0 && (
                  <div>
                    <p className="faint">Matched</p>
                    <div className="chips">
                      {match.matched.map((s) => (
                        <span className="chip ok" key={s}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {match.missing.length > 0 && (
                  <div>
                    <p className="faint">Wanted, not in your profile</p>
                    <div className="chips">
                      {match.missing.map((s) => (
                        <span className="chip" key={s}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="faint">Computed on your device — no AI provider, no API key.</p>
              </div>
            )}
          </section>
        </>
      )}

      {/* Announced to assistive tech: every outcome in the popup lands here. */}
      <p
        className={status ? `status ${status.tone}` : 'status'}
        role="status"
        aria-live="polite"
      >
        {status?.text ?? ''}
      </p>

      <hr className="divider" />

      <div className="row-between">
        <button className="subtle" onClick={() => chrome.runtime.openOptionsPage()}>
          Settings
        </button>
        <span className="faint">{provider ? `via ${provider}` : 'no AI provider set'}</span>
      </div>
    </div>
  )
}
