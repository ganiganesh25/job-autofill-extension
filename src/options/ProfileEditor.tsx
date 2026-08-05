import { useEffect, useState } from 'react'
import { sendToBackground } from '../lib/messaging'
import { emptyProfile, safeParseProfile, type Profile } from '../lib/profile-schema'
import { extractTextFromPdf } from '../lib/resume-parser'
import { getActiveProvider, getProfile, saveProfile } from '../lib/storage'

export default function ProfileEditor() {
  const [profile, setProfile] = useState<Profile>(emptyProfile)
  const [profileJson, setProfileJson] = useState('')
  const [status, setStatus] = useState<string>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getProfile<Profile>().then((saved) => {
      if (saved) {
        setProfile(saved)
        setProfileJson(JSON.stringify(saved, null, 2))
      }
    })
  }, [])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setStatus('Extracting text from PDF...')
    try {
      const resumeText = await extractTextFromPdf(file)
      const activeProvider = await getActiveProvider()
      if (!activeProvider) {
        setStatus('Extracted text — set an AI provider in Settings first to auto-fill the profile fields below, or edit the JSON manually.')
        setProfileJson(JSON.stringify({ ...emptyProfile, rawResumeText: resumeText }, null, 2))
        return
      }
      setStatus('Asking AI provider to structure the resume...')
      const rawJson = await sendToBackground<string>({
        type: 'EXTRACT_PROFILE',
        provider: activeProvider,
        resumeText,
      })
      const parsed = safeParseProfile({ ...JSON.parse(rawJson), rawResumeText: resumeText })
      if (parsed.success) {
        setProfile(parsed.data)
        setProfileJson(JSON.stringify(parsed.data, null, 2))
        setStatus('Review the extracted profile below, then Save.')
      } else {
        setStatus('AI response did not match the expected shape — edit the JSON manually below.')
        setProfileJson(rawJson)
      }
    } catch (error) {
      setStatus(`Failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  function handleSave() {
    try {
      const data = JSON.parse(profileJson)
      const result = safeParseProfile(data)
      if (!result.success) {
        setStatus(`Invalid profile: ${result.error.issues[0]?.message}`)
        return
      }
      saveProfile(result.data)
      setProfile(result.data)
      setStatus('Profile saved.')
    } catch {
      setStatus('Invalid JSON.')
    }
  }

  return (
    <section className="stack">
      <div className="stack-sm">
        <h2>Step 2 — Profile</h2>
        <p className="muted">
          Upload a resume PDF to extract your profile. The PDF is parsed in your browser and never
          uploaded; only the extracted text is sent to your AI provider. Review the result before
          saving.
        </p>
      </div>

      <div className="field">
        <label htmlFor="resume">Resume PDF</label>
        <input
          id="resume"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={busy}
        />
      </div>

      {status && (
        <p className="notice">
          {busy && <span className="spinner" style={{ display: 'inline-block', marginRight: 6 }} />}
          {status}
        </p>
      )}

      <div className="field">
        <label htmlFor="profilejson">Profile (editable JSON)</label>
        <textarea
          id="profilejson"
          value={profileJson}
          onChange={(e) => setProfileJson(e.target.value)}
          rows={18}
          placeholder="Upload a resume above, or paste/write your profile JSON here."
        />
      </div>

      <div className="row">
        <button className="primary" onClick={handleSave} disabled={busy}>
          Save profile
        </button>
        <span className="faint">
          {profile.fullName ? `Saved: ${profile.fullName}` : 'No profile saved yet.'}
        </span>
      </div>
    </section>
  )
}
