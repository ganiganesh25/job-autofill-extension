// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { detectFields, isQuestion } from './generic-heuristic'

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
    render(`<label for="e">Email address</label><input id="e" />`)
    expect(detectFields()[0].type).toBe('email')
  })

  it('still classifies a real address field as a location', () => {
    render(`<label for="a">Street address</label><input id="a" />`)
    expect(detectFields()[0].type).toBe('location')
  })

  it('keeps visually hidden file inputs', () => {
    render(`
      <label for="r">Resume</label>
      <input id="r" type="file" style="display: none" />
    `)
    const fields = detectFields()
    expect(fields).toHaveLength(1)
    expect(fields[0].type).toBe('resume')
    expect(fields[0].control).toBe('file')
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

  it('strips the required-marker asterisk from labels', () => {
    render(`<label for="c">Current Location*</label><input id="c" />`)
    const [field] = detectFields()
    expect(field.type).toBe('location')
    expect(field.label).toBe('Current Location')
  })
})

// Every case below is real markup from the live Intercom/Fin application form
// at job-boards.greenhouse.io, where unanchored keyword matching would have
// written the applicant's data into the wrong controls.
describe('regressions from the live Greenhouse form', () => {
  it('does not treat a marketing opt-in as an email field', () => {
    render(`
      <label for="q47">Please email me about future job openings *</label>
      <input id="q47" role="combobox" aria-autocomplete="list" />
    `)
    const [field] = detectFields()
    // Previously matched /\bemail\b/ (the verb) and would have had the
    // applicant's email address typed into a yes/no dropdown.
    expect(field.type).toBe('unknown')
  })

  it('does not treat a hybrid-working question as a location field', () => {
    render(`
      <label for="q46">We work under a hybrid in-office model. Are you willing to work from our office location 3 days per week?*</label>
      <input id="q46" role="combobox" aria-autocomplete="list" />
    `)
    const [field] = detectFields()
    // Previously matched on "office location".
    expect(field.type).toBe('unknown')
  })

  it('recognises Greenhouse dropdowns as comboboxes, not text inputs', () => {
    render(`
      <label for="country">Country*</label>
      <input id="country" role="combobox" aria-autocomplete="list" />
    `)
    const [field] = detectFields()
    expect(field.type).toBe('country')
    expect(field.control).toBe('combobox')
  })

  it('drops the unlabelled required-validation inputs paired with each combobox', () => {
    render(`
      <label for="q43">How did you hear about this job?*</label>
      <input id="q43" role="combobox" aria-autocomplete="list" />
      <input class="remix-css-1a0ro4n-requiredInput" />
    `)
    // The phantom input has no label, id, or name — keeping it inflated the
    // field count and shifted the indices the popup fills by.
    expect(detectFields()).toHaveLength(1)
  })

  it('still detects the genuine open-ended questions', () => {
    render(`
      <label for="q44">What excites you most about this opportunity?</label>
      <textarea id="q44"></textarea>
      <label for="q45">Which Fin value resonates most with you and why?</label>
      <textarea id="q45"></textarea>
    `)
    expect(detectFields().map((f) => f.type)).toEqual(['openEnded', 'openEnded'])
  })

  it('still detects the six standard Greenhouse fields', () => {
    render(`
      <label for="first_name">First Name</label><input id="first_name" />
      <label for="last_name">Last Name</label><input id="last_name" />
      <label for="email">Email</label><input id="email" />
      <label for="phone">Phone</label><input id="phone" type="tel" />
      <label for="resume">Attach</label><input id="resume" type="file" />
    `)
    expect(detectFields().map((f) => f.type)).toEqual([
      'firstName',
      'lastName',
      'email',
      'phone',
      'resume',
    ])
  })
})

describe('isQuestion', () => {
  it('treats trailing question marks as questions, required marker included', () => {
    expect(isQuestion('Are you willing to relocate?')).toBe(true)
    expect(isQuestion('Are you willing to relocate?*')).toBe(true)
  })

  it('treats overlong labels as questions', () => {
    expect(isQuestion('a'.repeat(81))).toBe(true)
  })

  it('does not treat plain field names as questions', () => {
    expect(isQuestion('Email')).toBe(false)
    expect(isQuestion('Current Location')).toBe(false)
  })
})
