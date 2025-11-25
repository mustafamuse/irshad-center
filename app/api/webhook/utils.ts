import { logger } from '@/lib/logger'

import { LogEventData } from './types'

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
    {
      err: error instanceof Error ? error : new Error(String(error)),
      eventId,
      context,
    },
    `Error processing event`
  )
}
