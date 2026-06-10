/**
 * Lightweight fuzzy matching for user search
 *
 * Scoring tiers (higher wins): exact match > prefix > substring > subsequence.
 * Within the subsequence tier, shorter targets score slightly higher so the
 * closest match sorts first.
 */

const SCORE_EXACT = 1000
const SCORE_PREFIX = 750
const SCORE_SUBSTRING = 500
const SCORE_SUBSEQUENCE = 250

export interface SearchableUser {
  gid: string
  name?: string
  email?: string
}

export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase()
  const t = text.toLowerCase()

  if (!q || !t) {
    return 0
  }
  if (t === q) {
    return SCORE_EXACT
  }
  if (t.startsWith(q)) {
    return SCORE_PREFIX
  }
  if (t.includes(q)) {
    return SCORE_SUBSTRING
  }
  if (isSubsequence(q, t)) {
    // Prefer tighter targets among subsequence matches
    return SCORE_SUBSEQUENCE - Math.min(t.length - q.length, SCORE_SUBSEQUENCE - 1)
  }
  return 0
}

function isSubsequence(query: string, text: string): boolean {
  let index = 0
  for (const char of text) {
    if (char === query[index]) {
      index++
    }
    if (index === query.length) {
      return true
    }
  }
  return false
}

/**
 * Search users by name or email, sorted by best match first
 */
export function searchUsers<T extends SearchableUser>(users: T[], query: string): T[] {
  return users
    .map(user => ({
      user,
      score: Math.max(
        fuzzyScore(query, user.name ?? ''),
        fuzzyScore(query, user.email ?? ''),
      ),
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.user)
}
