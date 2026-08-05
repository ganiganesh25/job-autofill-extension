import '../styles.css'
import ProfileEditor from './ProfileEditor'
import ProviderSettings from './ProviderSettings'

export default function App() {
  return (
    <div className="options stack">
      <header className="stack-sm">
        <h1>Job Autofill — Settings</h1>
        <p className="muted">
          Set up an AI provider and a profile, then open the extension on a Greenhouse, Lever,
          Workday, or LinkedIn application page.
        </p>
      </header>
      <hr className="divider" />
      <ProviderSettings />
      <hr className="divider" />
      <ProfileEditor />
    </div>
  )
}
