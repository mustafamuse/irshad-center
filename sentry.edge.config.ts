// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /ssn/i,
  /social[_-]?security/i,
  /credit[_-]?card/i,
  /card[_-]?number/i,
  /cvv/i,
  /cvc/i,
  /expir/i,
  /bank[_-]?account/i,
  /routing[_-]?number/i,
  /date[_-]?of[_-]?birth/i,
  /dob/i,
  /birth[_-]?date/i,
]

function redactSensitiveData(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))) {
      redacted[key] = '[Redacted]'
    } else if (Array.isArray(value)) {
      redacted[key] = value.map((item) =>
        item && typeof item === 'object'
          ? redactSensitiveData(item as Record<string, unknown>)
          : item
      )
    } else if (value && typeof value === 'object') {
      redacted[key] = redactSensitiveData(value as Record<string, unknown>)
    } else {
      redacted[key] = value
    }
  }
  return redacted
}

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

  debug: false,
  enableLogs: true,
  sendDefaultPii: false,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE,

  beforeSend(event, _hint) {
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
      return null
    }

    if (event.request?.data && typeof event.request.data === 'object') {
      event.request.data = redactSensitiveData(
        event.request.data as Record<string, unknown>
      )
    }
    if (event.extra && typeof event.extra === 'object') {
      event.extra = redactSensitiveData(event.extra as Record<string, unknown>)
    }
    if (event.contexts && typeof event.contexts === 'object') {
      for (const [key, context] of Object.entries(event.contexts)) {
        if (context && typeof context === 'object') {
          event.contexts[key] = redactSensitiveData(
            context as Record<string, unknown>
          )
        }
      }
    }
    return event
  },
})
