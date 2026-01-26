import * as Sentry from '@sentry/nextjs'

import { LogEventData } from './types'

export function logEvent(
  message: string,
  eventId: string,
  data: LogEventData
): void {
  console.log(`[${message}] Event ID: ${eventId}`, data)
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
