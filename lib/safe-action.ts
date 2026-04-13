import { headers } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'

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
    unstable_rethrow(e)
    if (e instanceof ActionError && e.statusCode < 500) {
      return e.message
    }
    await logError(logger, e, 'Unhandled action error', {
      actionName: utils.metadata?.actionName,
    })
    return e instanceof ActionError ? e.message : 'Something went wrong'
  },
})

export const adminActionClient = actionClient.use(async ({ next }) => {
  await assertAdmin()
  return next()
})

async function enforceRateLimit(
  actionName: string,
  headersList: Awaited<ReturnType<typeof headers>>
) {
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (!ip) return
  const result = await checkRateLimit(`${actionName}:${ip}`)
  if (!result.success) {
    throw new ActionError(
      'Too many attempts. Please try again later.',
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      undefined,
      429
    )
  }
}

export const rateLimitedActionClient = actionClient.use(
  async ({ next, metadata }) => {
    await enforceRateLimit(metadata.actionName, await headers())
    return next()
  }
)

export const rateLimitedAdminActionClient = adminActionClient.use(
  async ({ next, metadata }) => {
    await enforceRateLimit(metadata.actionName, await headers())
    return next()
  }
)
