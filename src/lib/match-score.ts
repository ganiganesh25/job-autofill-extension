// Deterministic, on-device match scoring. No AI provider, no API key, no
// network call.
//
// This replaces asking a model for a bare percentage, which had two problems
// beyond cost: a model that replied in prose scored as a confident 0% (see
// parseMatchScore), and a single number with no reasoning told the user
// nothing actionable. Computing overlap locally is instant, free, reproducible
// for the same inputs, and yields the matched/missing breakdown for free.

/** Words carrying no signal about whether a candidate fits a role. */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from', 'has', 'have',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'that', 'the', 'their', 'this', 'to', 'we',
  'will', 'with', 'you', 'your', 'they', 'them', 'other', 'more', 'most', 'can', 'able', 'work',
  'working', 'team', 'teams', 'role', 'roles', 'job', 'jobs', 'company', 'experience', 'years',
  'year', 'skills', 'strong', 'good', 'great', 'excellent', 'across', 'within', 'into', 'about',
  'who', 'what', 'why', 'how', 'when', 'where', 'all', 'any', 'each', 'well', 'also', 'not',
])

/** Normalises a skill or token so "Node.js", "node js" and "nodejs" compare equal. */
function canonical(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9+#]/g, '')
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((t) => t.replace(/\.$/, ''))
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

export interface MatchResult {
  /** 0-100. */
  score: number
  /** Profile skills the posting explicitly mentions. */
  matched: string[]
  /** Profile skills the posting does not mention. */
  unmatched: string[]
  /** Prominent terms in the posting that the profile does not cover. */
  missing: string[]
}

/**
 * Scores a profile against a job description by skill overlap, weighted by how
 * often each term appears in the posting.
 *
 * A skill the posting names repeatedly counts for more than one mentioned in
 * passing, so a candidate matching the central requirements outranks one
 * matching a long tail of incidental keywords.
 */
export function computeLocalMatch(
  skills: string[],
  profileText: string,
  jobDescription: string,
  maxMissing = 6,
): MatchResult {
  const jobTokens = tokenize(jobDescription)
  if (jobTokens.length === 0 || skills.length === 0) {
    return { score: 0, matched: [], unmatched: [...skills], missing: [] }
  }

  const frequency = new Map<string, number>()
  for (const token of jobTokens) {
    const key = canonical(token)
    if (key) frequency.set(key, (frequency.get(key) ?? 0) + 1)
  }

  const matched: string[] = []
  const unmatched: string[] = []
  let earned = 0
  let available = 0

  for (const skill of skills) {
    // A skill matches either as a single fused term ("Node.js" written as
    // "node.js" in the posting, both canonicalising to "nodejs") or as its
    // separate words all appearing ("node js"). Checking only one of the two
    // misses whichever spelling the posting happened to use.
    const fused = canonical(skill)
    const words = skill
      .split(/[^a-zA-Z0-9+#]+/)
      .map(canonical)
      .filter((w) => w.length > 0)

    const fusedHits = frequency.get(fused) ?? 0
    const wordHits = words.map((w) => frequency.get(w) ?? 0)
    const wordsAllPresent = words.length > 0 && wordHits.every((h) => h > 0)
    const present = fusedHits > 0 || wordsAllPresent

    const hits = fusedHits > 0 ? [fusedHits] : wordHits
    // Diminishing weight: the tenth mention of a term is not ten times the signal.
    const weight = 1 + Math.log2(1 + Math.max(...hits, 0))

    available += weight
    if (present) {
      earned += weight
      matched.push(skill)
    } else {
      unmatched.push(skill)
    }
  }

  const covered = tokenize(`${profileText} ${skills.join(' ')}`).map(canonical)
  const coveredSet = new Set(covered)
  const missing = [...frequency.entries()]
    .filter(([term, count]) => count > 1 && term.length > 2 && !coveredSet.has(term))
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxMissing)
    .map(([term]) => term)

  const score = available === 0 ? 0 : Math.round((earned / available) * 100)
  return { score: Math.min(100, Math.max(0, score)), matched, unmatched, missing }
}
