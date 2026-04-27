import * as Sentry from '@sentry/nextjs'
import { type Instrumentation } from 'next'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
    const { env } = await import('@/lib/env')

    // Run in dev too (not just production) so geofence misconfiguration surfaces
    // at startup rather than silently at first teacher check-in attempt.
    // Guarded by var presence so devs without teacher check-in vars don't crash.
    // lib/env (imported above) already enforces via superRefine that LAT and LNG
    // must both be set or both absent — this adds a semantic check (non-zero values).
    if (env.NODE_ENV !== 'test' && env.IRSHAD_CENTER_LAT !== undefined) {
      try {
        const { validateCenterLocationConfig } = await import(
          '@/lib/constants/teacher-checkin'
        )
        validateCenterLocationConfig()
      } catch (err) {
        Sentry.captureException(err, {
          tags: { source: 'startup', check: 'geofence-config' },
        })
        console.error(
          '[instrumentation] Geofence configuration is invalid. ' +
            'Check IRSHAD_CENTER_LAT and IRSHAD_CENTER_LNG in your environment.',
          err
        )
        throw err
      }
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
