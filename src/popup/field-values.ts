// Resolves what the extension would write into a detected field, given the
// saved profile. Extracted from the popup so it can be unit-tested and so the
// field list can preview values without duplicating the mapping.
import type { Profile } from '../lib/profile-schema'
import type { FieldType } from '../content/types'

export function profileValueForType(profile: Profile, type: FieldType): string | null {
  switch (type) {
    case 'fullName':
      return profile.fullName || null
    case 'firstName':
      return profile.fullName?.split(' ')[0] || null
    case 'lastName': {
      const parts = profile.fullName?.trim().split(/\s+/) ?? []
      return parts.length > 1 ? parts[parts.length - 1] : null
    }
    case 'email':
      return profile.email || null
    case 'phone':
      return profile.phone || null
    case 'location':
      return profile.location || null
    case 'country':
      return profile.country || null
    case 'linkedin':
      return profile.links?.linkedin || null
    case 'github':
      return profile.links?.github || null
    case 'portfolio':
      return profile.links?.portfolio || null
    default:
      return null
  }
}

/** Field types the AI answers rather than the profile filling. */
export function isAnswerable(type: FieldType): boolean {
  return type === 'openEnded' || type === 'coverLetter'
}

/** Masks a value for display so the popup never shows a full email or phone on screen. */
export function previewValue(type: FieldType, value: string): string {
  if (type === 'email') {
    const [user, domain] = value.split('@')
    if (!domain) return value
    const head = user.slice(0, Math.min(3, user.length))
    return `${head}${user.length > 3 ? '…' : ''}@${domain}`
  }
  if (type === 'phone' && value.length > 4) {
    return `${'•'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`
  }
  return value.length > 42 ? `${value.slice(0, 41)}…` : value
}

export function profileSummary(profile: Profile): string {
  const experience = profile.workExperience.map((w) => `${w.title} at ${w.company}`).join('; ')
  return `${profile.fullName}. Skills: ${profile.skills.join(', ')}. Experience: ${experience}. ${profile.summary ?? ''}`
}
