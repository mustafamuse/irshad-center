// In-memory store: resets on cold start. Effective for single-instance,
// best-effort in serverless. Use Redis/Upstash for strict enforcement.
const attempts = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const MAX_MAP_SIZE = 10_000

function pruneExpired(now: number) {
  attempts.forEach((value, key) => {
    if (now > value.resetAt) {
      attempts.delete(key)
    }
  })
}

export async function checkRateLimit(
  identifier: string,
  maxAttempts: number = MAX_ATTEMPTS
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const now = Date.now()
  const record = attempts.get(identifier)

  if (!record || now > record.resetAt) {
    if (attempts.size >= MAX_MAP_SIZE) {
      pruneExpired(now)
      if (attempts.size >= MAX_MAP_SIZE) {
        // Prefer evicting a non-blocked entry to preserve rate-limited identifiers.
        // Only fall back to oldest if every entry is at the limit.
        let evictKey: string | undefined
        attempts.forEach((value, key) => {
          if (evictKey === undefined && value.count < MAX_ATTEMPTS) {
            evictKey = key
          }
        })
        if (evictKey === undefined) {
          const first = attempts.keys().next()
          if (!first.done) evictKey = first.value
        }
        if (evictKey !== undefined) attempts.delete(evictKey)
      }
    }
    attempts.set(identifier, { count: 1, resetAt: now + WINDOW_MS })
    return {
      success: true,
      remaining: maxAttempts - 1,
      reset: now + WINDOW_MS,
    }
  }

  if (record.count >= maxAttempts) {
    return { success: false, remaining: 0, reset: record.resetAt }
  }

  record.count++
  return {
    success: true,
    remaining: maxAttempts - record.count,
    reset: record.resetAt,
  }
}
