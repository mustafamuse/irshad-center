import * as Sentry from '@sentry/nextjs'
import { type Instrumentation } from 'next'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/env')
    await import('./sentry.server.config')

    // Run in dev too (not just production) so geofence misconfiguration surfaces
    // at startup rather than silently at first teacher check-in attempt.
    // Guarded by var presence so devs without teacher check-in vars don't crash.
    if (
      process.env.NODE_ENV !== 'test' &&
      (process.env.IRSHAD_CENTER_LAT || process.env.IRSHAD_CENTER_LNG)
    ) {
      const { validateCenterLocationConfig } = await import(
        '@/lib/constants/teacher-checkin'
      )
      validateCenterLocationConfig()
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  Sentry.captureRequestError(error, request, context)

  try {
    const { Logger } = await import('next-axiom')
    const logger = new Logger({ source: 'request-error' })
    logger.error('Request error', {
      error: error instanceof Error ? error.message : String(error),
      path: request.path,
      method: request.method,
      routeType: context.routeType,
      routePath: context.routePath,
    })
    await logger.flush()
  } catch (e) {
    console.error('Axiom logging failed in onRequestError:', e)
  }
}
