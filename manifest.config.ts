import { defineManifest } from '@crxjs/vite-plugin'
import packageJson from './package.json'

const { version } = packageJson

export default defineManifest({
  manifest_version: 3,
  name: 'Job Autofill (open source, BYO AI key)',
  description:
    'Autofills job applications and drafts tailored answers using your own AI provider key. No backend, no subscription, no telemetry.',
  version,
  icons: {
    16: 'public/icons/icon16.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage', 'activeTab', 'scripting'],
  optional_host_permissions: [
    'https://*.greenhouse.io/*',
    'https://*.lever.co/*',
    'https://*.myworkdayjobs.com/*',
    'https://*.linkedin.com/*',
  ],
  // Declarative content scripts only activate on a domain once the user has
  // granted the matching optional host permission (requested contextually
  // from the popup/options UI) — nothing runs until the user opts in per site.
  content_scripts: [
    {
      matches: [
        'https://*.greenhouse.io/*',
        'https://*.lever.co/*',
        'https://*.myworkdayjobs.com/*',
        'https://*.linkedin.com/*',
      ],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
})
