import { describe, expect, it } from 'vitest'
import { parseMatchScore } from './prompts'

describe('parseMatchScore', () => {
  it('parses a bare integer', () => {
    expect(parseMatchScore('85')).toBe(85)
    expect(parseMatchScore('  72  ')).toBe(72)
  })

  it('parses a score the model wrapped in prose', () => {
    // The previous parseInt-based version returned 0 for all of these, which
    // was indistinguishable from a genuine 0% match.
    expect(parseMatchScore("I'd rate this 85/100")).toBe(85)
    expect(parseMatchScore('Match score: 42')).toBe(42)
    expect(parseMatchScore('**78**')).toBe(78)
  })

  it('clamps out-of-range values', () => {
    expect(parseMatchScore('150')).toBe(100)
  })

  it('returns null when there is no number to find', () => {
    expect(parseMatchScore('I cannot determine a score.')).toBeNull()
    expect(parseMatchScore('')).toBeNull()
  })

  it('distinguishes a real zero from an unparseable answer', () => {
    expect(parseMatchScore('0')).toBe(0)
    expect(parseMatchScore('no match at all')).toBeNull()
  })
})
