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
    <section>
      <h2>Profile</h2>
      <p>
        Upload a resume PDF to extract your profile (parsed entirely in your browser — the file is
        never uploaded anywhere). Review and edit the result before saving.
      </p>
      <input type="file" accept="application/pdf" onChange={handleFileChange} disabled={busy} />
      {status && <p style={{ fontSize: 13, color: '#555' }}>{status}</p>}
      <textarea
        value={profileJson}
        onChange={(e) => setProfileJson(e.target.value)}
        rows={20}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
      />
      <div>
        <button onClick={handleSave} disabled={busy}>
          Save profile
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#888' }}>{profile.fullName ? `Loaded: ${profile.fullName}` : 'No profile saved yet.'}</p>
    </section>
  )
}
