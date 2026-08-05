# Job Autofill

An open-source Chrome extension that autofills job application forms and drafts
tailored answers (cover letter blurbs, "why this company") using AI — with your
own API key, no subscription, no backend, no telemetry.

Currently supports Greenhouse, Lever, Workday, and LinkedIn Easy Apply, with a
generic fallback for any other application form.

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
└── types/          # message contracts between UI, background, and content scripts
```

## Development

Requires Node 18.18+ (Node 20+ recommended — some tooling in this repo is
pinned to older majors to stay compatible with Node 18; upgrading Node lets
you use the latest Vite/Vitest/ESLint and picks up their security fixes).

```bash
npm install
npm run dev      # Vite dev server with HMR (crxjs)
npm run build    # production build to dist/
npm run lint     # ESLint, including eslint-plugin-security
npm test         # Vitest unit tests
```

To load the unpacked extension in Chrome:

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder

After granting a site permission from the popup, reload that tab once before
reopening the popup — the content script activates on page load once
permission is granted.

## Contributing

This is intentionally simple and un-clever: no build magic beyond Vite, no
state management library, no CSS framework. PRs adding/improving ATS
detectors are especially welcome — `src/content/detectors/` is the place to
add support for a new job platform, following the existing pattern of
"platform-specific overrides + generic heuristic fallback."

If you find a security issue, please open an issue describing it rather than
a PR with a fix, so it can be discussed before the details are public.

## License

MIT
