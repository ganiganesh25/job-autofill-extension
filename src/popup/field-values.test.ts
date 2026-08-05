import { describe, expect, it } from 'vitest'
import { isAnswerable, previewValue, profileValueForType } from './field-values'
import { emptyProfile, type Profile } from '../lib/profile-schema'

const profile: Profile = {
  ...emptyProfile,
  fullName: 'Ada Lovelace King',
  email: 'ada@example.com',
  phone: '+447700900123',
  location: 'London',
  country: 'United Kingdom',
  links: { linkedin: 'https://linkedin.com/in/ada', github: 'https://github.com/ada' },
  skills: ['Rust'],
}

describe('profileValueForType', () => {
  it('resolves the flat identity fields', () => {
    expect(profileValueForType(profile, 'fullName')).toBe('Ada Lovelace King')
    expect(profileValueForType(profile, 'email')).toBe('ada@example.com')
    expect(profileValueForType(profile, 'location')).toBe('London')
    expect(profileValueForType(profile, 'country')).toBe('United Kingdom')
  })

  it('splits first and last name, taking the final part as the surname', () => {
    expect(profileValueForType(profile, 'firstName')).toBe('Ada')
    expect(profileValueForType(profile, 'lastName')).toBe('King')
  })

  it('returns null for a single-word name rather than repeating it as a surname', () => {
    const single = { ...profile, fullName: 'Ada' }
    expect(profileValueForType(single, 'firstName')).toBe('Ada')
    expect(profileValueForType(single, 'lastName')).toBeNull()
  })

  it('tolerates extra whitespace in the name', () => {
    const spaced = { ...profile, fullName: '  Ada   King  ' }
    expect(profileValueForType(spaced, 'lastName')).toBe('King')
  })

  it('returns null for links that are not set', () => {
    expect(profileValueForType(profile, 'portfolio')).toBeNull()
    expect(profileValueForType(profile, 'github')).toBe('https://github.com/ada')
  })

  it('returns null for types the profile cannot fill', () => {
    expect(profileValueForType(profile, 'openEnded')).toBeNull()
    expect(profileValueForType(profile, 'resume')).toBeNull()
    expect(profileValueForType(profile, 'unknown')).toBeNull()
  })
})

describe('isAnswerable', () => {
  it('marks the AI-answered types', () => {
    expect(isAnswerable('openEnded')).toBe(true)
    expect(isAnswerable('coverLetter')).toBe(true)
    expect(isAnswerable('email')).toBe(false)
  })
})

// The popup shows these on screen, so they must not expose a full contact
// detail to anyone glancing at the window.
describe('previewValue', () => {
  it('masks the local part of an email but keeps the domain', () => {
    expect(previewValue('email', 'ganiganeshss79@gmail.com')).toBe('gan…@gmail.com')
  })

  it('leaves a short local part unabbreviated', () => {
    expect(previewValue('email', 'ada@example.com')).toBe('ada@example.com')
  })

  it('passes through a malformed email unchanged', () => {
    expect(previewValue('email', 'not-an-email')).toBe('not-an-email')
  })

  it('masks all but the last four digits of a phone number', () => {
    expect(previewValue('phone', '+447700900123')).toBe('•••••••••0123')
  })

  it('truncates long values', () => {
    const long = 'x'.repeat(60)
    expect(previewValue('location', long)).toHaveLength(42)
    expect(previewValue('location', long).endsWith('…')).toBe(true)
  })

  it('leaves ordinary short values alone', () => {
    expect(previewValue('location', 'London')).toBe('London')
  })
})
