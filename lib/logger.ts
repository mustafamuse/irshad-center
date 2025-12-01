/**
 * Pino Logger Configuration for Irshad Center
 *
 * Production-grade structured logging with:
 * - Automatic redaction of sensitive data (payment cards, API keys, secrets)
 * - Visible contact info (emails, phones) for debugging
 * - Child loggers for context binding
 * - Pretty-printed output in development, JSON in production
 * - Optimized for Next.js 15 App Router and Vercel deployment
 * - Integrated with Sentry for error tracking and correlation
 */

import { headers } from 'next/headers'

import * as Sentry from '@sentry/nextjs'
import pino from 'pino'
import pretty from 'pino-pretty'

const logLevel =
  process.env.PINO_LOG_LEVEL ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

const isDevelopment = process.env.NODE_ENV !== 'production'

const devStream = isDevelopment
  ? pretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      singleLine: false,
      messageFormat: '{levelLabel} [{source}] {msg}',
      sync: true,
    })
  : undefined

/**
 * Base logger configuration
 *
 * Key features:
 * - Redacts payment card data, API keys, passwords (PCI/security compliance)
 * - Keeps emails and phones visible (needed for customer support debugging)
 * - Structured JSON output for searchability
 * - Pretty-printed in development for readability
 */
export const logger = pino(
  {
    level: logLevel,

    redact: {
      paths: [
        'password',
        'token',
        'apiKey',
        'api_key',
        'accessToken',
        'refreshToken',
        'secret',
        'authorization',
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'headers.authorization',
        'headers.cookie',
        'stripeSecretKey',
        'stripe_secret_key',
        'STRIPE_SECRET_KEY_PROD',
        'STRIPE_SECRET_KEY_DUGSI',
        'STRIPE_WEBHOOK_SECRET_PROD',
        'STRIPE_WEBHOOK_SECRET_DUGSI',
        'paymentMethod.card.number',
        'paymentMethod.card.cvc',
        'paymentMethod.card.exp_month',
        'paymentMethod.card.exp_year',
        'source.card.number',
        'source.card.cvc',
        'card.number',
        'card.cvc',
        'cardNumber',
        'cvc',
        'bank_account.account_number',
        'bank_account.routing_number',
        'accountNumber',
        'routingNumber',
        'DATABASE_URL',
        'DIRECT_URL',
        'connectionString',
        'RESEND_API_KEY',
        'CRON_SECRET_KEY',
        'ADMIN_PASSWORD',
        'NEXTAUTH_SECRET',
      ],
      censor: '[REDACTED]',
      remove: false,
    },

    base: {
      env: process.env.NODE_ENV,
      app: 'irshad-center',
    },

    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,

      req: (req) => {
        if (!req) return undefined
        return {
          method: req.method,
          url: req.url,
          headers: {
            host: req.headers?.host,
            'user-agent': req.headers?.['user-agent'],
          },
        }
      },

      res: (res) => {
        if (!res) return undefined
        return {
          statusCode: res.statusCode,
        }
      },
    },
  },
  devStream
)

/**
 * Create a child logger with specific context
 *
 * Child loggers inherit all parent configuration while adding
 * consistent context fields that appear in every log.
 *
 * @param context - Context fields to add to all logs
 * @returns Child logger instance
 *
 * @example
 * const webhookLogger = createLogger({ source: 'webhook', program: 'mahad' })
 * webhookLogger.info({ eventId: '123' }, 'Processing webhook')
 * // Output includes: { source: 'webhook', program: 'mahad', eventId: '123', msg: 'Processing webhook' }
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context)
}

/**
 * Database logger with connection pool context
 *
 * Use for all database-related logging (connection pool events, queries, errors)
 *
 * @example
 * dbLogger.info('Database connection established')
 * dbLogger.error({ err }, 'Query failed')
 */
export const dbLogger = createLogger({ source: 'database' })

/**
 * Create a webhook logger for Mahad or Dugsi program
 *
 * @param program - Program type ('mahad' or 'dugsi')
 * @returns Webhook logger with program context
 *
 * @example
 * const logger = createWebhookLogger('mahad')
 * logger.info({ eventType: 'customer.subscription.created', eventId }, 'Webhook received')
 */
export function createWebhookLogger(program: 'mahad' | 'dugsi') {
  return createLogger({ source: 'webhook', program })
}

/**
 * Create an action logger for server actions
 *
 * @param action - Action name (e.g., 'deleteDugsiFamily', 'createMahadBatch')
 * @returns Action logger with action context
 *
 * @example
 * const logger = createActionLogger('deleteDugsiFamily')
 * logger.info({ familyId }, 'Deleting family')
 * logger.error({ err, familyId }, 'Failed to delete family')
 */
export function createActionLogger(action: string) {
  return createLogger({ source: 'action', action })
}

/**
 * Create an API route logger
 *
 * @param route - API route path (e.g., '/api/admin/profit-share')
 * @returns API logger with route context
 *
 * @example
 * const logger = createAPILogger('/api/admin/profit-share')
 * logger.info('Processing profit share calculation')
 * logger.error({ err }, 'Calculation failed')
 */
export function createAPILogger(route: string) {
  return createLogger({ source: 'api', route })
}

/**
 * Create a service logger for business logic layer
 *
 * @param service - Service name (e.g., 'UnifiedMatcher', 'PaymentService')
 * @returns Service logger with service context
 *
 * @example
 * const logger = createServiceLogger('UnifiedMatcher')
 * logger.debug({ email }, 'Searching for profile')
 * logger.info({ profileId }, 'Profile found')
 */
export function createServiceLogger(service: string) {
  return createLogger({ source: 'service', name: service })
}

/**
 * Create a cron job logger
 *
 * @param job - Cron job name (e.g., 'cleanup-abandoned-enrollments')
 * @returns Cron logger with job context
 *
 * @example
 * const logger = createCronLogger('cleanup-abandoned-enrollments')
 * logger.info('Starting cleanup job')
 * logger.info({ customersProcessed, duration }, 'Cleanup completed')
 */
export function createCronLogger(job: string) {
  return createLogger({ source: 'cron', job })
}

// Type exports for TypeScript
export type Logger = typeof logger
export type ChildLogger = ReturnType<typeof createLogger>

// ============================================================================
// Enhanced Error Handling & Correlation
// ============================================================================

/**
 * Serializes unknown errors into Pino-compatible format
 *
 * Replaces the verbose pattern:
 * `{ err: error instanceof Error ? error : new Error(String(error)) }`
 *
 * @param error - Error from catch block (unknown type)
 * @returns Object with properly serialized error for Pino
 *
 * @example
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   logger.error(serializeError(error), 'Operation failed')
 * }
 */
export function serializeError(error: unknown): { err: Error } {
  if (error instanceof Error) {
    return { err: error }
  }

  // Handle Prisma errors that have special metadata
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error
  ) {
    const prismaError = error as {
      code: string
      message: string
      meta?: unknown
    }
    const err = new Error(prismaError.message)
    err.name = 'PrismaError'
    // Attach Prisma-specific metadata
    Object.assign(err, { code: prismaError.code, meta: prismaError.meta })
    return { err }
  }

  // Convert anything else to Error
  return { err: new Error(String(error)) }
}

/**
 * Generate a unique request ID for correlation
 * Uses crypto.randomUUID if available, falls back to timestamp-based ID
 */
function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Gets the current request context (request ID, user ID, etc.)
 *
 * Use this to add correlation IDs to logs for tracing requests
 * across multiple services and operations.
 *
 * The requestId is synchronized with Sentry for cross-correlation:
 * - If x-request-id header exists, use it
 * - If Sentry has a trace ID, use it for correlation
 * - Otherwise, generate a new ID and set it in Sentry scope
 *
 * @returns Request context object or empty object if not in request context
 *
 * @example
 * const logger = createActionLogger('processPayment')
 * const context = await getRequestContext()
 * logger.info({ ...context, amount }, 'Processing payment')
 * // Includes requestId for correlation with Sentry and other logs
 */
export async function getRequestContext(): Promise<Record<string, unknown>> {
  try {
    const headersList = await headers()
    let requestId = headersList.get('x-request-id')
    const userId = headersList.get('x-user-id')

    // If no request ID from headers, try to get from Sentry or generate new one
    if (!requestId) {
      const sentryScope = Sentry.getCurrentScope()
      const propagationContext = sentryScope.getPropagationContext()

      if (propagationContext?.traceId) {
        // Use Sentry trace ID for correlation
        requestId = propagationContext.traceId
      } else {
        // Generate new ID and set in Sentry for correlation
        requestId = generateRequestId()
        sentryScope.setTag('requestId', requestId)
      }
    } else {
      // If we have a request ID from header, also set it in Sentry
      Sentry.getCurrentScope().setTag('requestId', requestId)
    }

    return {
      ...(requestId && { requestId }),
      ...(userId && { userId }),
    }
  } catch {
    // Not in request context (e.g., cron jobs, background tasks)
    // Generate a correlation ID for background tasks
    const backgroundId = generateRequestId()
    Sentry.getCurrentScope().setTag('requestId', backgroundId)
    return { requestId: backgroundId, isBackgroundTask: true }
  }
}

/**
 * Logs an error to both Pino (for structured logs) and Sentry (for error tracking)
 *
 * This function:
 * 1. Logs the error with Pino for structured log aggregation
 * 2. Sends the error to Sentry for error tracking and alerting
 * 3. Adds request context (requestId, userId) for correlation
 * 4. Preserves error stack traces and metadata
 *
 * @param logger - Pino logger instance (or child logger)
 * @param error - Error from catch block
 * @param message - Human-readable error message
 * @param context - Additional context to include in logs and Sentry
 *
 * @example
 * const logger = createActionLogger('updateStudent')
 * try {
 *   await updateStudent(studentId, data)
 * } catch (error) {
 *   await logError(logger, error, 'Failed to update student', { studentId, data })
 *   throw error // Re-throw if needed
 * }
 */
export async function logError(
  logger: Logger | ChildLogger,
  error: unknown,
  message: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const requestContext = await getRequestContext()
  const serialized = serializeError(error)
  const fullContext = { ...serialized, ...requestContext, ...context }

  // Log to Pino for structured logs
  logger.error(fullContext, message)

  // Send to Sentry for error tracking
  const sentryTags: Record<string, string> = {}
  if (requestContext.requestId) {
    sentryTags.requestId = String(requestContext.requestId)
  }
  if (requestContext.userId) {
    sentryTags.userId = String(requestContext.userId)
  }

  Sentry.captureException(serialized.err, {
    tags: sentryTags,
    extra: context,
    level: 'error',
  })
}

/**
 * Logs a warning to both Pino and Sentry (as breadcrumb)
 *
 * Warnings are logged but don't create Sentry issues. They appear
 * as breadcrumbs that provide context when errors occur.
 *
 * @param logger - Pino logger instance
 * @param message - Warning message
 * @param context - Additional context
 *
 * @example
 * await logWarning(logger, 'Unusual payment amount detected', { amount, customerId })
 */
export async function logWarning(
  logger: Logger | ChildLogger,
  message: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const requestContext = await getRequestContext()
  const fullContext = { ...requestContext, ...context }

  // Log to Pino
  logger.warn(fullContext, message)

  // Add breadcrumb to Sentry (helps debug future errors)
  Sentry.addBreadcrumb({
    message,
    level: 'warning',
    data: context,
  })
}
