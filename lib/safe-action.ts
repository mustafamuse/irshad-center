'use server'

import { headers } from 'next/headers'
import { createSafeActionClient } from 'next-safe-action'
import { z } from 'zod'

import { assertAdmin } from '@/lib/auth'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createActionLogger, logError } from '@/lib/logger'

const logger = createActionLogger('safe-action')

export const actionClient = createSafeActionClient({
  defineMetadataSchema() {
    return z.object({ actionName: z.string() })
  },
  async handleServerError(e, utils) {
    if (e instanceof ActionError) {
      return e.message
    }
    await logError(logger, e, 'Unhandled action error', {
      actionName: utils.metadata?.actionName,
    })
    return 'Something went wrong'
  },
})

export const adminActionClient = actionClient.use(async ({ next }) => {
  await assertAdmin()
  return next()
})

export const rateLimitedActionClient = actionClient.use(
  async ({ next, metadata }) => {
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    const key = `${metadata.actionName}:${ip}`
    const result = await checkRateLimit(key)
    if (!result.success) {
      throw new ActionError(
        'Too many attempts. Please try again later.',
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        undefined,
        429
      )
    }
    return next()
  }
)
