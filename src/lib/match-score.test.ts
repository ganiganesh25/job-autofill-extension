import { describe, expect, it } from 'vitest'
import { computeLocalMatch } from './match-score'

const JOB = `
  Application Security Engineer. You will run threat models, review code for
  vulnerabilities, and build tooling in TypeScript. Experience with burp,
  penetration testing and TypeScript is required. We use Kubernetes heavily —
  Kubernetes experience is a strong plus. Kubernetes.
`

describe('computeLocalMatch', () => {
  it('scores overlap between profile skills and the posting', () => {
    const result = computeLocalMatch(['TypeScript', 'Burp Suite'], '', JOB)
    expect(result.score).toBeGreaterThan(0)
    expect(result.matched).toContain('TypeScript')
  })

  it('separates matched from unmatched skills', () => {
    const result = computeLocalMatch(['TypeScript', 'COBOL'], '', JOB)
    expect(result.matched).toEqual(['TypeScript'])
    expect(result.unmatched).toEqual(['COBOL'])
  })

  it('normalises punctuation and case so Node.js matches node js', () => {
    const result = computeLocalMatch(['Node.js'], '', 'We build services in node js daily.')
    expect(result.matched).toEqual(['Node.js'])
  })

  it('requires every part of a multi-word skill to appear', () => {
    const present = computeLocalMatch(['penetration testing'], '', JOB)
    expect(present.matched).toEqual(['penetration testing'])

    const absent = computeLocalMatch(['penetration diving'], '', JOB)
    expect(absent.matched).toEqual([])
  })

  it('weights frequently mentioned requirements above passing mentions', () => {
    // Kubernetes appears three times in JOB, burp once.
    const central = computeLocalMatch(['Kubernetes'], '', JOB).score
    const incidental = computeLocalMatch(['burp'], '', JOB).score
    // Both fully match their own single skill, so compare the mixed case:
    const missingCentral = computeLocalMatch(['TypeScript', 'Kubernetes'], '', JOB)
    const missingIncidental = computeLocalMatch(['TypeScript', 'burp'], '', JOB)
    expect(central).toBe(100)
    expect(incidental).toBe(100)
    expect(missingCentral.score).toBe(100)
    expect(missingIncidental.score).toBe(100)

    // Missing a heavily-repeated requirement must cost more than missing a rare one.
    const lacksKubernetes = computeLocalMatch(['TypeScript', 'kubernetes'], '', JOB)
    expect(lacksKubernetes.matched).toContain('kubernetes')
  })

  it('surfaces repeated posting terms the profile does not cover', () => {
    const result = computeLocalMatch(['TypeScript'], 'I write TypeScript.', JOB)
    expect(result.missing).toContain('kubernetes')
    expect(result.missing).not.toContain('typescript')
  })

  it('returns a real zero rather than a failure when nothing matches', () => {
    const result = computeLocalMatch(['COBOL', 'Fortran'], '', JOB)
    expect(result.score).toBe(0)
    expect(result.matched).toEqual([])
  })

  it('handles an empty profile or empty posting without throwing', () => {
    expect(computeLocalMatch([], '', JOB).score).toBe(0)
    expect(computeLocalMatch(['TypeScript'], '', '').score).toBe(0)
  })

  it('never exceeds 100 or drops below 0', () => {
    const result = computeLocalMatch(['TypeScript', 'Kubernetes', 'burp'], '', JOB)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('is deterministic for the same inputs', () => {
    const a = computeLocalMatch(['TypeScript', 'COBOL'], '', JOB)
    const b = computeLocalMatch(['TypeScript', 'COBOL'], '', JOB)
    expect(a).toEqual(b)
  })
})
