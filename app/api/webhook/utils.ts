import * as Sentry from '@sentry/nextjs'

import { createServiceLogger } from '@/lib/logger'

import { LogEventData } from './types'

const logger = createServiceLogger('webhook')

export function logEvent(
  message: string,
  eventId: string,
  data: LogEventData
): void {
  logger.info(data, message)
}

export function handleError(
  context: string,
  eventId: string,
  error: unknown
): void {
  Sentry.captureException(error, {
    extra: { eventId, context },
  })
}
