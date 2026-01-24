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
  logger.error(
    { err: error, eventId, context },
    `Error processing webhook event`
  )
}
