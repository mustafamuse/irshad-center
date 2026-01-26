// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
//
// NOTE: This is the new recommended approach for Next.js with Turbopack.
// Eventually sentry.client.config.ts will be deprecated.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  sendDefaultPii: false,

  // Replay configuration for session replay
  replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0, // 10% in prod, 0% in dev

  integrations: [], // Replay integration will be lazy-loaded after page is interactive

  // Configure which errors to ignore
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'chrome-extension://',
    'moz-extension://',
    // Random network errors
    'NetworkError',
    'Failed to fetch',
    'Load failed',
    // Stripe-related errors (handled separately)
    /stripe/i,
  ],

  // Filter out transactions we don't care about
  beforeSend(event, _hint) {
    // Don't send events in development unless explicitly enabled
    if (
      process.env.NODE_ENV === 'development' &&
      !process.env.NEXT_PUBLIC_SENTRY_DEBUG
    ) {
      return null
    }

    // Add custom context
    if (event.request?.headers) {
      // Redact sensitive headers
      delete event.request.headers['Authorization']
      delete event.request.headers['Cookie']
    }

    return event
  },

  environment: process.env.NODE_ENV || 'development',

  // Release tracking (set by CI/CD)
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
})

// Lazy load replay integration after page is interactive
// This reduces initial Sentry initialization time and improves page load performance
if (typeof window !== 'undefined') {
  const loadReplay = () => {
    import('@sentry/nextjs').then((lazyLoadedSentry) => {
      Sentry.addIntegration(
        lazyLoadedSentry.replayIntegration({
          maskAllText: true, // Mask all text for privacy
          blockAllMedia: true, // Block all media for privacy
        })
      )
    })
  }

  // Load after page is interactive (use requestIdleCallback if available)
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadReplay, { timeout: 2000 })
  } else {
    setTimeout(loadReplay, 0)
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
