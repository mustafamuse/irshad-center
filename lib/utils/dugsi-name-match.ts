/**
 * Dugsi student name matching.
 *
 * Reconciles human-typed attendance-sheet names against canonical DB names.
 * The expensive error here is a FALSE match (merging two different students),
 * so folding is conservative and anything uncertain is surfaced as `low`
 * (needs human review) rather than auto-matched.
 *
 * Pure module: no DB, no I/O — unit-testable in isolation.
 */

export type MatchConfidence = 'exact' | 'high' | 'medium' | 'low' | 'none'

export interface NameComparison {
  confidence: MatchConfidence
  score: number
  reason: string
}

export interface NameMatchResult<T = string> {
  query: string
  match: T | null
  matchName: string | null
  confidence: MatchConfidence
  score: number
  reason: string
}

const CONFIDENCE_RANK: Record<MatchConfidence, number> = {
  exact: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
}

/** Auto-match tiers — `low` is intentionally excluded (needs review). */
export function isAutoMatch(confidence: MatchConfidence): boolean {
  return CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK.medium
}

/**
 * Transliteration aliases applied as substring replacements before folding.
 * Extend with domain knowledge — keep only mappings that are unambiguously the
 * SAME name (never fold distinct names like Mohamed vs Mohamoud).
 */
export const NAME_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/shiekh/g, 'sheikh'], // ShiekhAli / Sheikhali transliteration
]

/** trim, strip diacritics, drop punctuation (hyphens → space), collapse spaces, lowercase. */
export function normalizeName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation/hyphens → space
    .replace(/\s+/g, ' ')
    .trim()
}

/** Canonicalize transliteration variants + collapse doubled letters (Nuur→Nur, Yussuf→Yusuf). */
export function foldVariants(normalized: string): string {
  let folded = normalized
  for (const [pattern, replacement] of NAME_ALIASES) {
    folded = folded.replace(pattern, replacement)
  }
  return folded.replace(/(.)\1+/g, '$1') // collapse runs of the same char
}

function tokens(value: string): string[] {
  return value.split(' ').filter(Boolean)
}

/** Multiset equality: duplicate tokens must match in count, not just presence
 * (so "Ibrahim Ibrahim" and "Ibrahim" are NOT equal — a Set would collapse
 * the duplicate and wrongly treat these as the same token set). */
function setEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((t, i) => t === sb[i])
}

/** True if the smaller distinct token set is fully contained in the larger. */
function isSubset(a: string[], b: string[]): boolean {
  const sa = new Set(a)
  const sb = new Set(b)
  const [small, large] = sa.size <= sb.size ? [sa, sb] : [sb, sa]
  for (const t of small) if (!large.has(t)) return false
  return true
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[b.length]
}

function ratio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

/**
 * Greedy best-aligned token similarity. Each candidate token may satisfy at
 * most ONE query token (so a repeated name like "Ibrahim Ibrahim" can't score
 * 1.0 against "Hamza Ibrahim"), and the denominator is the LARGER token count
 * so unmatched tokens on either side reduce the score.
 */
function tokenAlignmentScore(a: string[], b: string[]): number {
  const [small, large] = a.length <= b.length ? [a, b] : [b, a]
  if (!small.length) return 0
  const used = new Array(large.length).fill(false)
  let total = 0
  for (const t of small) {
    let best = 0
    let bestIdx = -1
    for (let i = 0; i < large.length; i++) {
      if (used[i]) continue
      const r = ratio(t, large[i])
      if (r > best) {
        best = r
        bestIdx = i
      }
    }
    if (bestIdx >= 0) {
      used[bestIdx] = true
      total += best
    }
  }
  return total / Math.max(a.length, b.length)
}

const AUTO_THRESHOLD = 0.88
const REVIEW_THRESHOLD = 0.78

/** Compare two raw names and classify the relationship. */
export function compareNames(a: string, b: string): NameComparison {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (na === nb) return { confidence: 'exact', score: 1, reason: 'exact' }

  const ta = tokens(na)
  const tb = tokens(nb)
  const singleToken = Math.min(ta.length, tb.length) <= 1

  if (setEqual(ta, tb)) {
    return { confidence: 'high', score: 0.97, reason: 'token-set-equal' }
  }

  const fa = foldVariants(na)
  const fb = foldVariants(nb)
  if (fa === fb)
    return { confidence: 'high', score: 0.95, reason: 'variant-exact' }

  const fta = tokens(fa)
  const ftb = tokens(fb)
  if (setEqual(fta, ftb)) {
    return { confidence: 'high', score: 0.93, reason: 'variant-token-set' }
  }

  // Same letters, different word boundaries: "Sheikhali" vs "Shiekh Ali".
  const spacelessA = fa.replace(/\s+/g, '')
  const spacelessB = fb.replace(/\s+/g, '')
  if (spacelessA === spacelessB) {
    return { confidence: 'high', score: 0.92, reason: 'variant-spaceless' }
  }

  // Strict subset (extra name part) → NEVER auto-match: in this data
  // "Hamza Mohamed" and "Hamza Mohamed Aziz" are distinct students.
  // Surface as a review candidate, not a silent drop and not an auto-match.
  if (!singleToken && fta.length !== ftb.length && isSubset(fta, ftb)) {
    return { confidence: 'low', score: 0.7, reason: 'subset-extra-token' }
  }

  const score = Math.max(
    tokenAlignmentScore(fta, ftb),
    ratio(spacelessA, spacelessB)
  )

  // Single-token names are too collision-prone to auto-match beyond exact.
  if (singleToken) {
    if (score >= REVIEW_THRESHOLD) {
      return { confidence: 'low', score, reason: 'single-token-fuzzy' }
    }
    return { confidence: 'none', score, reason: 'single-token-no-match' }
  }

  if (score >= AUTO_THRESHOLD) {
    return { confidence: 'medium', score, reason: 'fuzzy' }
  }
  if (score >= REVIEW_THRESHOLD) {
    return { confidence: 'low', score, reason: 'fuzzy-review' }
  }
  return { confidence: 'none', score, reason: 'no-match' }
}

/**
 * Find the best matching candidate for `query`.
 * `key` maps a candidate to its comparable name string (defaults to identity).
 */
export function matchName<T = string>(
  query: string,
  candidates: readonly T[],
  key: (candidate: T) => string = (c) => c as unknown as string
): NameMatchResult<T> {
  let best: NameMatchResult<T> = {
    query,
    match: null,
    matchName: null,
    confidence: 'none',
    score: 0,
    reason: 'no-match',
  }

  for (const candidate of candidates) {
    const candidateName = key(candidate)
    const cmp = compareNames(query, candidateName)
    const better =
      CONFIDENCE_RANK[cmp.confidence] > CONFIDENCE_RANK[best.confidence] ||
      (CONFIDENCE_RANK[cmp.confidence] === CONFIDENCE_RANK[best.confidence] &&
        cmp.score > best.score)
    if (cmp.confidence !== 'none' && better) {
      best = {
        query,
        match: candidate,
        matchName: candidateName,
        confidence: cmp.confidence,
        score: cmp.score,
        reason: cmp.reason,
      }
    }
  }

  return best
}
