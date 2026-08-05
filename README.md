# Job Autofill

An open-source Chrome extension that autofills job application forms and drafts
tailored answers (cover letter blurbs, "why this company") using AI — with your
own API key, no subscription, no backend, no telemetry.

Currently supports Greenhouse, Lever, Workday, and LinkedIn Easy Apply, with a
generic fallback for any other application form.

**[Jump to Setup →](#setup)**

## Why this exists

Commercial tools like Simplify do this well but charge for it and run your data
through their servers. This does the same job with a different tradeoff: you
bring your own AI provider key (OpenAI, Anthropic, Gemini, Ollama, or any
OpenAI-compatible endpoint), everything runs in your browser, and the project
is free and open source so anyone can use it, audit it, or extend it.

## How it works

- **Resume parsing** happens entirely client-side (`pdf.js`) — your resume file
  is never uploaded anywhere.
- **Field detection** runs in a content script injected only on domains you've
  explicitly granted permission for (Greenhouse/Lever/Workday/LinkedIn), using
  platform-specific detectors with a generic label-matching fallback.
- **AI calls** (answer generation, resume-to-profile extraction, job match
  scoring) go straight from your browser to your chosen provider's API. There
  is no intermediary server.
- **Filling** writes values into form fields using safe DOM APIs only — never
  `innerHTML` — so AI-generated or job-posting text can't be interpreted as
  markup on the page.

## Threat model

**API key storage.** Keys are encrypted (AES-GCM) before being persisted in
`chrome.storage.local`. The wrapping key itself lives only in
`chrome.storage.session`, which Chrome keeps in memory and clears when the
browser closes — it never touches disk. This means:

- A backup, disk snapshot, or another local process reading `chrome.storage.local`
  gets ciphertext, not your keys.
- Restarting the browser clears the wrapping key, so you'll need to re-enter
  your API key(s) after a restart. That's the deliberate tradeoff for never
  persisting plaintext secrets to disk.
- This does **not** protect against a compromised browser process itself, or
  against a malicious/compromised version of this extension — install only
  from source you've reviewed or a release you trust.

**Network egress.** The only network calls this extension makes are to the AI
provider you configure, initiated only when you trigger an action (fill form,
generate answer, compute match score). There is no analytics, telemetry, or
first-party backend of any kind.

**Permissions.** The extension requests no host permissions at install time.
Each ATS domain (Greenhouse, Lever, Workday, LinkedIn) is requested as an
*optional* permission the first time you use the extension on that site, via
Chrome's standard permission prompt. `activeTab` + `scripting` cover
programmatic access to the current tab; there is no `<all_urls>` permission.

**Untrusted input.** Job descriptions, resume text, and AI responses are all
treated as untrusted: control characters are stripped before interpolation
into prompts, and DOM writes always go through `.value` + synthetic
`input`/`change` events, never `innerHTML`.

**Known limitation.** This does not defend against a compromised or malicious
AI provider endpoint — you're trusting whichever provider you configure with
your resume and job-application context. Use Ollama (local, self-hosted) if
you don't want any of that data leaving your machine at all.

## Project structure

```
src/
├── background/    # service worker — owns API key decryption and all AI calls
├── content/       # injected per-site: field detection + safe DOM fill
│   └── detectors/ # greenhouse.ts, lever.ts, workday.ts, linkedin.ts, generic-heuristic.ts
├── popup/         # per-tab UI: detect fields, fill, generate answers, match score
├── options/       # profile editor (resume upload) + AI provider settings
├── lib/
│   ├── crypto.ts       # AES-GCM encrypt/decrypt
│   ├── storage.ts       # typed chrome.storage wrapper (API keys, profile, settings)
│   ├── resume-parser.ts # client-side PDF text extraction
│   ├── profile-schema.ts# zod schema for the structured profile
│   ├── sanitize.ts       # untrusted-input handling for prompts/DOM
│   └── ai/               # provider abstraction + openai/anthropic/gemini/ollama/openai-compatible
├── styles.css      # shared stylesheet for popup + options (light/dark)
└── types/          # message contracts between UI, background, and content scripts
```

## Setup

Start to finish, this takes about five minutes. Steps 1–3 install the
extension; steps 4–5 configure it. It does nothing useful until step 5 is
done.

### 1. Prerequisites

- **Node 18.18+** (Node 20+ recommended). Check with `node -v`.
- **Google Chrome** or any Chromium browser with Manifest V3 support
  (Edge, Brave, Arc).
- An **API key** from one AI provider — see step 4. Skip this if you plan to
  run Ollama locally.

### 2. Build

```bash
git clone https://github.com/ganiganesh25/job-autofill-extension.git
cd job-autofill-extension
npm install
npm run build
```

This produces a `dist/` folder. That folder — not the repo root — is what
Chrome loads.

### 3. Load into Chrome

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (toggle, top right)
3. Click **Load unpacked**
4. Select the **`dist/`** folder inside the repo

"Job Autofill" now appears in your extensions list. Pin it to the toolbar via
the puzzle-piece icon so the popup is one click away.

> After any code change you must re-run `npm run build` and click the **reload**
> (↻) icon on the extension card. Chrome does not pick up changes on its own.

### 4. Configure an AI provider

Click the extension icon → **Open Settings** (or right-click the icon →
**Options**). Under **Step 1 — AI provider**, pick one:

| Provider | Where to get a key | Default model | Notes |
| --- | --- | --- | --- |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `gpt-4o-mini` | Cheapest of the hosted options |
| Anthropic | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) | `claude-sonnet-5` | |
| Google Gemini | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | `gemini-1.5-flash` | Has a free tier |
| Ollama | no key needed | `llama3.1` | Fully local — nothing leaves your machine |
| OpenAI-compatible | depends on the service | — | Groq, OpenRouter, etc. **Base URL required** |

Paste your key and click **Save**. Model and Base URL are optional for
everything except the OpenAI-compatible provider.

**Using Ollama instead:** install [Ollama](https://ollama.com), run
`ollama pull llama3.1`, make sure `ollama serve` is running, then select
Ollama in Settings and Save. No key, and no resume or job data ever leaves
your device.

> **Keys clear when you close the browser.** This is deliberate — the
> encryption key lives only in memory and is never written to disk, so a disk
> backup can never yield your API keys. On restart, Settings shows the
> provider as *needs re-entry*; paste the key again and Save.

### 5. Add your profile

Still in Settings, under **Step 2 — Profile**:

1. Click **Choose file** and pick your resume PDF. It's parsed in your browser
   via pdf.js — the file itself is never uploaded.
2. The extracted text is sent to your configured provider, which returns
   structured JSON. This takes a few seconds.
3. Review the JSON in the editor — AI extraction is not perfect, so check your
   name, email, and phone especially.
4. Click **Save profile**.

No provider configured yet? You can skip the AI step and write the JSON by
hand; the shape is defined in `src/lib/profile-schema.ts`.

### 6. Use it on an application

1. Open a job application on Greenhouse, Lever, Workday, or LinkedIn Easy
   Apply.
2. Click the extension icon. The first time on each site it asks for
   permission for that domain — click **Enable for &lt;site&gt;** and accept
   Chrome's prompt.
3. **Reload the page once.** The content script only attaches on page load, so
   it isn't running yet on the tab you just granted permission for. This is a
   one-time step per site.
4. Reopen the popup. You should see *N fields detected*.
5. **Fill known fields from profile** writes name, email, phone, links, and
   location. **Generate** drafts an answer for each open-ended question.
   **Compute match %** scores your profile against the posting.

If the page changes (Workday and LinkedIn are multi-step wizards), click
**Re-detect** before filling again — the previously detected fields no longer
exist in the DOM.

### Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `npm run build` fails on `node:crypto` | Node too old, or `npm install` didn't complete. Needs Node 18.18+. |
| Popup says "isn't a supported site yet" | Only Greenhouse, Lever, Workday, and LinkedIn are supported. Other sites need a detector — see Contributing. |
| "Could not reach this page" | The content script isn't running. Reload the tab (step 6.3). |
| "0 fields detected" after reload | The form may be in an iframe or rendered after load. Click **Re-detect** once the form is visible. |
| "No API key saved for …" | No key configured for the active provider. Settings → Step 1. |
| "…encrypted in a previous browser session" | Expected after a browser restart. Re-enter the key and Save. |
| "The page changed since fields were detected" | SPA navigation invalidated the fields. Click **Re-detect**. |
| Nothing happens after editing code | Re-run `npm run build`, then click ↻ on the extension card. |

### Development

```bash
npm run dev      # Vite dev server with HMR (crxjs)
npm run build    # production build to dist/
npm run lint     # ESLint, including eslint-plugin-security
npm test         # Vitest unit tests
```

Some tooling here is pinned to older majors to stay compatible with Node 18
(jsdom 24, Vite 5, Vitest 1). On Node 20+ you can raise those and pick up
their security fixes.

## Contributing

This is intentionally simple and un-clever: no build magic beyond Vite, no
state management library, no CSS framework — styling is one plain stylesheet
(`src/styles.css`) driven by CSS custom properties. PRs adding/improving ATS
detectors are especially welcome — `src/content/detectors/` is the place to
add support for a new job platform, following the existing pattern of
"platform-specific overrides + generic heuristic fallback."

If you find a security issue, please open an issue describing it rather than
a PR with a fix, so it can be discussed before the details are public.

## License

MIT
