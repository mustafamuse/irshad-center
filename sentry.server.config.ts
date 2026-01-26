// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
if (!dsn && process.env.NODE_ENV === 'production') {
  console.error('[Sentry] SENTRY_DSN not configured - error tracking disabled')
}

Sentry.init({
  dsn: dsn || '',

  tracesSampler: (samplingContext) => {
    const name = samplingContext.name || ''
    if (name.includes('webhook')) return 1.0
    if (name.includes('health') || name.includes('_next/static')) return 0
    return process.env.NODE_ENV === 'production' ? 0.1 : 1.0
  },

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  sendDefaultPii: false,

  // Configure which errors to ignore
  ignoreErrors: [
    // Prisma connection errors (logged separately)
    'PrismaClientInitializationError',
    // Stripe webhook signature validation (expected)
    'No signatures found matching the expected signature',
  ],

  // Add custom context for server errors
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
      return null
    }

    // Add server-specific context
    const error = hint.originalException
    if (error && typeof error === 'object' && 'code' in error) {
      // Prisma errors have a code property
      event.contexts = event.contexts || {}
      event.contexts.prisma = {
        code: (error as { code?: string }).code,
      }
    }

    // Redact sensitive data
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers['Authorization']
        delete event.request.headers['Cookie']
        delete event.request.headers['stripe-signature']
      }

      // Remove sensitive query params
      if (event.request.query_string) {
        const url = new URL(event.request.url || '', 'http://localhost')
        url.searchParams.delete('token')
        url.searchParams.delete('apiKey')
        event.request.query_string = url.search.slice(1)
      }
    }

    return event
  },

  environment: process.env.NODE_ENV || 'development',

  // Release tracking (set by CI/CD)
  release: process.env.SENTRY_RELEASE,

  // Enable Node.js profiling (optional, for performance monitoring)
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
})
