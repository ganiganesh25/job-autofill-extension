import ProfileEditor from './ProfileEditor'
import ProviderSettings from './ProviderSettings'

export default function App() {
  return (
    <div style={{ padding: 24, maxWidth: 640, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Job Autofill — Settings</h1>
      <ProviderSettings />
      <hr />
      <ProfileEditor />
    </div>
  )
}
