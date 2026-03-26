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
        let oldestKey: string | null = null
        let oldestReset = Infinity
        attempts.forEach((value, key) => {
          if (value.resetAt < oldestReset) {
            oldestReset = value.resetAt
            oldestKey = key
          }
        })
        if (oldestKey) attempts.delete(oldestKey)
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
