import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const DEFAULT_MAX_ATTEMPTS = 5
const WINDOW = '15 m' as const

let _redis: Redis | undefined
let _defaultRatelimit: Ratelimit | undefined

function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  )
}

function getRedis(): Redis {
  if (!_redis) {
    _redis = Redis.fromEnv()
  }
  return _redis
}

function getDefaultRatelimit(): Ratelimit {
  if (!_defaultRatelimit) {
    _defaultRatelimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(DEFAULT_MAX_ATTEMPTS, WINDOW),
      analytics: false,
      prefix: 'rl',
    })
  }
  return _defaultRatelimit
}

export async function checkRateLimit(
  identifier: string,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): Promise<{ success: boolean; remaining: number; reset: number }> {
  if (!isRedisConfigured()) {
    return { success: true, remaining: maxAttempts, reset: 0 }
  }

  const client =
    maxAttempts !== DEFAULT_MAX_ATTEMPTS
      ? new Ratelimit({
          redis: getRedis(),
          limiter: Ratelimit.slidingWindow(maxAttempts, WINDOW),
          analytics: false,
          prefix: 'rl',
        })
      : getDefaultRatelimit()

  const { success, remaining, reset } = await client.limit(identifier)
  return { success, remaining, reset }
}
