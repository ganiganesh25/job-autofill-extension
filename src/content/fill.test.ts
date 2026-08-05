// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { setFieldValue } from './fill'
import type { DetectedField, FillableElement } from './types'

function field(element: FillableElement, control: DetectedField['control']): DetectedField {
  return { element, type: 'unknown', control, label: 'test' }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('setFieldValue: plain text inputs', () => {
  it('writes the value and fires input/change', async () => {
    document.body.innerHTML = `<input id="e" />`
    const el = document.getElementById('e') as HTMLInputElement
    const events: string[] = []
    el.addEventListener('input', () => events.push('input'))
    el.addEventListener('change', () => events.push('change'))

    expect(await setFieldValue(field(el, 'text'), 'ada@example.com')).toBe(true)
    expect(el.value).toBe('ada@example.com')
    expect(events).toEqual(['input', 'change'])
  })
})

describe('setFieldValue: file inputs', () => {
  it('reports failure rather than pretending to attach a file', async () => {
    document.body.innerHTML = `<input id="r" type="file" />`
    const el = document.getElementById('r') as HTMLInputElement
    // The extension keeps only extracted text, never the original File.
    expect(await setFieldValue(field(el, 'file'), 'resume.pdf')).toBe(false)
  })
})

describe('setFieldValue: native selects', () => {
  it('matches an option by visible text', async () => {
    document.body.innerHTML = `<select id="s"><option value="uk">United Kingdom</option></select>`
    const el = document.getElementById('s') as HTMLSelectElement
    expect(await setFieldValue(field(el, 'select'), 'United Kingdom')).toBe(true)
    expect(el.value).toBe('uk')
  })

  it('reports failure when no option matches', async () => {
    document.body.innerHTML = `<select id="s"><option value="uk">United Kingdom</option></select>`
    const el = document.getElementById('s') as HTMLSelectElement
    expect(await setFieldValue(field(el, 'select'), 'Atlantis')).toBe(false)
  })
})

// Greenhouse renders every dropdown as input[type=text][role=combobox].
// Writing .value into one never updates the widget's internal state, so the
// typed text is silently discarded on submit — these must be driven instead.
describe('setFieldValue: comboboxes', () => {
  function renderCombobox(options: string[]) {
    document.body.innerHTML = `
      <input id="c" role="combobox" aria-controls="lb" aria-autocomplete="list" />
      <div id="lb" role="listbox"></div>
    `
    const input = document.getElementById('c') as HTMLInputElement
    const listbox = document.getElementById('lb') as HTMLElement
    // Real widgets populate the listbox in response to typing.
    input.addEventListener('input', () => {
      listbox.innerHTML = options
        .map((o) => `<div role="option">${o}</div>`)
        .join('')
      for (const opt of Array.from(listbox.children)) {
        opt.addEventListener('click', () => {
          input.value = opt.textContent ?? ''
        })
      }
    })
    return input
  }

  it('selects a matching option by clicking it', async () => {
    const input = renderCombobox(['United Kingdom', 'United States'])
    expect(await setFieldValue(field(input, 'combobox'), 'United Kingdom')).toBe(true)
    expect(input.value).toBe('United Kingdom')
  })

  it('matches case-insensitively and by prefix', async () => {
    const input = renderCombobox(['United Kingdom'])
    expect(await setFieldValue(field(input, 'combobox'), 'united king')).toBe(true)
    expect(input.value).toBe('United Kingdom')
  })

  it('restores the field and reports failure when nothing matches', async () => {
    const input = renderCombobox(['Yes', 'No'])
    expect(await setFieldValue(field(input, 'combobox'), 'London, England')).toBe(false)
    // Must not leave stray text in a control that will fail validation.
    expect(input.value).toBe('')
  })

  it('reports failure when the listbox never opens', async () => {
    document.body.innerHTML = `<input id="c" role="combobox" />`
    const input = document.getElementById('c') as HTMLInputElement
    expect(await setFieldValue(field(input, 'combobox'), 'anything')).toBe(false)
    expect(input.value).toBe('')
  }, 5000)
})
