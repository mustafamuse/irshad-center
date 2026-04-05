import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const redis = Redis.fromEnv()

const DEFAULT_MAX_ATTEMPTS = 5
const WINDOW = '15 m' as const

const defaultRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(DEFAULT_MAX_ATTEMPTS, WINDOW),
  analytics: false,
  prefix: 'rl',
})

export async function checkRateLimit(
  identifier: string,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const client =
    maxAttempts !== DEFAULT_MAX_ATTEMPTS
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(maxAttempts, WINDOW),
          analytics: false,
          prefix: 'rl',
        })
      : defaultRatelimit

  const { success, remaining, reset } = await client.limit(identifier)
  return { success, remaining, reset }
}
