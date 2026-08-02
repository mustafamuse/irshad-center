import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import { createServiceLogger } from '@/lib/logger'

const logger = createServiceLogger('rate-limit')
const DEFAULT_MAX_ATTEMPTS = 5
const WINDOW = '15 m' as const

let _redis: Redis | undefined
const _ratelimiters = new Map<number, Ratelimit>()
let _warnedMissingRedis = false

function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  )
}

function warnOnceIfRedisMissing(): void {
  if (_warnedMissingRedis) return
  _warnedMissingRedis = true
  const message =
    '[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set — rate limiting is disabled.'
  if (process.env.NODE_ENV === 'production') {
    logger.error(message)
  } else {
    logger.warn(message)
  }
}

function getRedis(): Redis {
  if (!_redis) {
    _redis = Redis.fromEnv()
  }
  return _redis
}

function getRatelimit(maxAttempts: number): Ratelimit {
  let limiter = _ratelimiters.get(maxAttempts)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(maxAttempts, WINDOW),
      analytics: false,
      prefix: 'rl',
    })
    _ratelimiters.set(maxAttempts, limiter)
  }
  return limiter
}

export interface RateLimitOptions {
  /**
   * When true, a Redis error counts as rate-limited instead of allowed.
   * Public unauthenticated endpoints must fail closed: their abuse ceiling
   * is the rate limit itself, so an Upstash outage (or an attacker who
   * exhausts the Upstash quota) must not remove the throttle. Admin-facing
   * actions keep the availability-first default.
   */
  failClosed?: boolean
}

export async function checkRateLimit(
  identifier: string,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  options: RateLimitOptions = {}
): Promise<{ success: boolean; remaining: number; reset: number }> {
  if (!isRedisConfigured()) {
    warnOnceIfRedisMissing()
    return { success: true, remaining: maxAttempts, reset: 0 }
  }

  try {
    const { success, remaining, reset } =
      await getRatelimit(maxAttempts).limit(identifier)
    return { success, remaining, reset }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      options.failClosed
        ? '[rate-limit] Redis error — failing closed'
        : '[rate-limit] Redis error — failing open'
    )
    if (options.failClosed) {
      return { success: false, remaining: 0, reset: 0 }
    }
    return { success: true, remaining: maxAttempts, reset: 0 }
  }
}
