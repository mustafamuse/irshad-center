/**
 * Client-Side Logger Utility
 *
 * Provides conditional logging for client-side components.
 * Logs are only output in development mode to avoid console pollution in production.
 * Integrates with Sentry for error tracking and session replay correlation.
 *
 * Usage:
 *   import { createClientLogger } from '@/lib/logger-client'
 *   const logger = createClientLogger('ComponentName')
 *   logger.error('Something went wrong', error)
 *   logger.warn('Warning message')
 *   logger.info('Info message')
 *   logger.debug('Debug message')
 */

import * as Sentry from '@sentry/nextjs'

const isDev = process.env.NODE_ENV === 'development'

export interface ClientLogger {
  error: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  debug: (message: string, ...args: unknown[]) => void
  log: (message: string, ...args: unknown[]) => void
}

/**
 * Create a contextual client-side logger
 * @param context - Component or module name for context
 * @returns Logger instance with error, warn, info, debug, log methods
 */
export function createClientLogger(context: string): ClientLogger {
  const prefix = `[${context}]`

  return {
    error: (message: string, ...args: unknown[]) => {
      // Always log errors (useful for debugging even in production)
      console.error(prefix, message, ...args)

      // Send error to Sentry for tracking
      const error =
        args.find((arg) => arg instanceof Error) || new Error(message)
      const extraData = args.filter((arg) => !(arg instanceof Error))

      Sentry.captureException(error, {
        tags: { context },
        extra: {
          message,
          args: extraData,
        },
        level: 'error',
      })
    },

    warn: (message: string, ...args: unknown[]) => {
      // Always log warnings
      console.warn(prefix, message, ...args)

      // Add breadcrumb to Sentry (helps debug future errors)
      Sentry.addBreadcrumb({
        message: `${prefix} ${message}`,
        level: 'warning',
        data: { context, args },
      })
    },

    info: (message: string, ...args: unknown[]) => {
      // Only log info in development
      if (isDev) {
        console.info(prefix, message, ...args)
      }

      // Add breadcrumb to Sentry (helps debug future errors)
      Sentry.addBreadcrumb({
        message: `${prefix} ${message}`,
        level: 'info',
        data: { context, args },
      })
    },

    debug: (message: string, ...args: unknown[]) => {
      // Only log debug in development
      if (isDev) {
        console.log(prefix, message, ...args)
      }

      // Add breadcrumb to Sentry in dev only
      if (isDev) {
        Sentry.addBreadcrumb({
          message: `${prefix} ${message}`,
          level: 'debug',
          data: { context, args },
        })
      }
    },

    log: (message: string, ...args: unknown[]) => {
      // Only log general logs in development
      if (isDev) {
        console.log(prefix, message, ...args)
      }

      // Add breadcrumb to Sentry in dev only
      if (isDev) {
        Sentry.addBreadcrumb({
          message: `${prefix} ${message}`,
          level: 'log',
          data: { context, args },
        })
      }
    },
  }
}

/**
 * Global client logger (use when no specific context is needed)
 */
export const clientLogger = createClientLogger('App')
