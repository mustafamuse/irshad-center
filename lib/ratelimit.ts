import { Ratelimit } from '@upstash/ratelimit'
import { kv } from '@vercel/kv'

import { createActionLogger } from '@/lib/logger'

const logger = createActionLogger('ratelimit')

type RateLimitResult = {
  success: boolean
  limit?: number
  remaining?: number
  reset?: number
}

const adminLoginLimiter =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(5, '15 m'),
        prefix: 'ratelimit:admin-login',
      })
    : null

export async function checkAdminLoginRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  if (!adminLoginLimiter) {
    logger.debug('Rate limiting disabled - KV not configured')
    return { success: true }
  }

  try {
    const result = await adminLoginLimiter.limit(identifier)
    if (!result.success) {
      logger.warn({ identifier }, 'Rate limit exceeded for admin login')
    }
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    logger.error({ error }, 'Rate limit check failed, allowing request')
    return { success: true }
  }
}
