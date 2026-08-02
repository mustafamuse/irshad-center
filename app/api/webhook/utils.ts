import { createServiceLogger, logError } from '@/lib/logger'

import { LogEventData } from './types'

const logger = createServiceLogger('webhook')

export function logEvent(
  message: string,
  eventId: string,
  data: LogEventData
): void {
  logger.info({ ...data, eventId }, message)
}

export async function handleError(
  context: string,
  eventId: string,
  error: unknown
): Promise<void> {
  await logError(logger, error, context, { eventId })
}
