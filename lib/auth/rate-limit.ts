const attempts = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

export async function checkRateLimit(
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const now = Date.now()
  const record = attempts.get(identifier)

  if (!record || now > record.resetAt) {
    attempts.set(identifier, { count: 1, resetAt: now + WINDOW_MS })
    return {
      success: true,
      remaining: MAX_ATTEMPTS - 1,
      reset: now + WINDOW_MS,
    }
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { success: false, remaining: 0, reset: record.resetAt }
  }

  record.count++
  return {
    success: true,
    remaining: MAX_ATTEMPTS - record.count,
    reset: record.resetAt,
  }
}
