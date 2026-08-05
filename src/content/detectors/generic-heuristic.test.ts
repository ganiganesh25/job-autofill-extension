// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { detectFields } from './generic-heuristic'

function render(html: string) {
  document.body.innerHTML = html
}

/** jsdom has no layout, so getClientRects() is always empty — stub visibility. */
beforeEach(() => {
  Element.prototype.getClientRects = function (this: Element) {
    const style = window.getComputedStyle(this)
    const hidden = style.display === 'none' || style.visibility === 'hidden'
    return (hidden ? [] : [{}]) as unknown as DOMRectList
  }
})

describe('generic heuristic detector', () => {
  it('classifies standard fields from their labels', () => {
    render(`
      <label for="e">Email</label><input id="e" />
      <label for="p">Phone</label><input id="p" />
      <label for="f">First name</label><input id="f" />
      <label for="l">LinkedIn</label><input id="l" />
    `)
    expect(detectFields().map((f) => f.type)).toEqual(['email', 'phone', 'firstName', 'linkedin'])
  })

  it('does not classify "Email address" as a location', () => {
    // Regression: the location rule matched /address/, and only the ordering
    // of the rules list kept this from misfiring.
    render(`<label for="e">Email address</label><input id="e" />`)
    expect(detectFields()[0].type).toBe('email')
  })

  it('still classifies a real address field as a location', () => {
    render(`<label for="a">Street address</label><input id="a" />`)
    expect(detectFields()[0].type).toBe('location')
  })

  it('keeps visually hidden file inputs', () => {
    // Regression: the old filter checked `el.type === 'file'` inside a branch
    // that only ran for hidden/submit/button/checkbox/radio, so file inputs
    // could never be kept — and most ATS resume inputs are display:none
    // behind a styled label.
    render(`
      <label for="r">Resume</label>
      <input id="r" type="file" style="display: none" />
    `)
    const fields = detectFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].type).toBe('resume')
  })

  it('drops non-fillable input types', () => {
    render(`
      <input type="hidden" name="csrf" />
      <input type="submit" value="Apply" />
      <input type="checkbox" id="agree" />
      <label for="e">Email</label><input id="e" />
    `)
    expect(detectFields().map((f) => f.type)).toEqual(['email'])
  })

  it('treats a textarea with no matching keyword as open-ended', () => {
    render(`<label for="q">Tell us something interesting</label><textarea id="q"></textarea>`)
    expect(detectFields()[0].type).toBe('openEnded')
  })

  it('reads labels from aria-label and placeholder', () => {
    render(`
      <input aria-label="GitHub profile" />
      <input placeholder="Your phone number" />
    `)
    expect(detectFields().map((f) => f.type)).toEqual(['github', 'phone'])
  })
})
