import * as Sentry from '@sentry/nextjs'
import { type Instrumentation } from 'next'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')

    if (process.env.NODE_ENV === 'production') {
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

  if (process.env.NEXT_PUBLIC_AXIOM_TOKEN) {
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
  }
}
