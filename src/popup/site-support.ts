const SUPPORTED_HOST_PATTERNS: { suffix: string; permissionPattern: string }[] = [
  { suffix: 'greenhouse.io', permissionPattern: 'https://*.greenhouse.io/*' },
  { suffix: 'lever.co', permissionPattern: 'https://*.lever.co/*' },
  { suffix: 'myworkdayjobs.com', permissionPattern: 'https://*.myworkdayjobs.com/*' },
  { suffix: 'linkedin.com', permissionPattern: 'https://*.linkedin.com/*' },
]

export function matchSupportedSite(hostname: string): string | null {
  const match = SUPPORTED_HOST_PATTERNS.find((p) => hostname.endsWith(p.suffix))
  return match?.permissionPattern ?? null
}
