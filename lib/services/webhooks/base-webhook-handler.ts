/**
 * Base Webhook Handler
 *
 * Factory function that creates Next.js Route handlers for Stripe webhooks.
 * Extracts common boilerplate for signature verification, idempotency,
 * error handling, and event routing.
 *
 * Usage:
 * ```typescript
 * export const POST = createWebhookHandler({
 *   source: 'dugsi',
 *   verifyWebhook: verifyDugsiWebhook,
 *   eventHandlers: {
 *     'checkout.session.completed': handleCheckoutCompleted,
 *     // ... more handlers
 *   }
 * })
 * ```
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'

import {
  createWebhookEventRecord,
  deleteWebhookEventByIdAndSource,
  findWebhookEventByIdAndSource,
  type WebhookSource,
} from '@/lib/db/queries/webhook-event'
import { createWebhookLogger, logError, logInfo } from '@/lib/logger'

/**
 * Webhook source identifier — canonical definition lives in the query layer
 * beside the idempotency functions it namespaces; re-exported here for
 * existing importers.
 */
export type { WebhookSource } from '@/lib/db/queries/webhook-event'

/**
 * Event handler function signature
 */
export type EventHandler = (event: Stripe.Event) => Promise<void>

/**
 * Configuration for webhook handler
 */
export interface WebhookHandlerConfig {
  /** Source identifier for this webhook (mahad, dugsi, etc.) */
  source: WebhookSource

  /** Function to verify webhook signature */
  verifyWebhook: (body: string, signature: string) => Stripe.Event

  /** Map of event types to handler functions */
  eventHandlers: Record<string, EventHandler>

  /** Optional: Validate request body before processing */
  validateBody?: (body: string) => boolean
}

/**
 * Create a Next.js Route handler for Stripe webhooks.
 *
 * Handles all common webhook operations:
 * - Request body reading and validation
 * - Signature verification
 * - Idempotency (duplicate event prevention)
 * - Event recording in database
 * - Event routing to appropriate handlers
 * - Error handling and cleanup
 *
 * @param config - Webhook handler configuration
 * @returns Next.js POST Route handler function
 */
export function createWebhookHandler(config: WebhookHandlerConfig) {
  const { source, verifyWebhook, eventHandlers, validateBody } = config
  const logger = createWebhookLogger(source)

  return async function POST(req: Request): Promise<NextResponse> {
    let eventId: string | undefined
    let eventRecordCreated = false

    try {
      // 1. Read raw body once for signature verification
      const body = await req.text()

      // 2. Validate body is not empty
      if (!body || body.trim().length === 0) {
        logger.error('Empty request body')
        return NextResponse.json(
          { message: 'Request body is required' },
          { status: 400 }
        )
      }

      // 3. Optional custom validation
      if (validateBody && !validateBody(body)) {
        logger.error('Body validation failed')
        return NextResponse.json(
          { message: 'Invalid request body' },
          { status: 400 }
        )
      }

      // 4. Get stripe-signature header
      const headersList = await headers()
      const signature = headersList.get('stripe-signature')

      if (!signature) {
        logger.error('Missing webhook signature')
        return NextResponse.json(
          { message: 'Missing signature' },
          { status: 400 }
        )
      }

      // 5. Verify the webhook signature
      let event: Stripe.Event
      try {
        event = await Sentry.startSpan(
          {
            name: 'webhook.verify_signature',
            op: 'webhook.security',
            attributes: {
              source,
              has_signature: !!signature,
            },
          },
          () => verifyWebhook(body, signature)
        )
      } catch (verificationError) {
        await logError(logger, verificationError, 'Webhook verification failed')
        return NextResponse.json(
          { message: 'Invalid webhook signature' },
          { status: 401 }
        )
      }

      eventId = event.id

      await logInfo(logger, 'Webhook received', {
        eventType: event.type,
        eventId,
        source,
      })

      // 6. Check for idempotency - prevent processing the same event twice
      const existingEvent = await Sentry.startSpan(
        {
          name: 'webhook.idempotency_check',
          op: 'db.query',
          attributes: {
            source,
            event_id: event.id,
            event_type: event.type,
          },
        },
        async () => await findWebhookEventByIdAndSource(event.id, source)
      )

      if (existingEvent) {
        logger.info({ eventId: event.id }, 'Event already processed, skipping')
        return NextResponse.json(
          { received: true, skipped: true },
          { status: 200 }
        )
      }

      // 7. Parse JSON payload safely after signature verification
      let payload: Prisma.InputJsonValue
      try {
        payload = JSON.parse(body) as Prisma.InputJsonValue
      } catch (parseError) {
        await logError(
          logger,
          parseError,
          'Failed to parse webhook body as JSON'
        )
        return NextResponse.json(
          { message: 'Invalid JSON payload' },
          { status: 400 }
        )
      }

      // 8. Record the event to prevent duplicate processing
      await Sentry.startSpan(
        {
          name: 'webhook.store_event',
          op: 'db.query',
          attributes: {
            source,
            event_id: event.id,
            event_type: event.type,
          },
        },
        async () =>
          await createWebhookEventRecord({
            eventId: event.id,
            eventType: event.type,
            source,
            payload,
          })
      )
      eventRecordCreated = true

      // 9. Route to appropriate event handler
      const handler = eventHandlers[event.type]
      if (handler) {
        await Sentry.startSpan(
          {
            name: 'webhook.execute_handler',
            op: 'webhook.processing',
            attributes: {
              source,
              event_type: event.type,
              event_id: event.id,
            },
          },
          async () => await handler(event)
        )
        await logInfo(logger, 'Webhook processed successfully', {
          eventType: event.type,
          eventId,
          source,
        })
      } else {
        logger.warn({ eventType: event.type }, 'Unhandled event type')
      }

      return NextResponse.json({ received: true }, { status: 200 })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      await logError(logger, err, 'Webhook error', {
        eventId,
        errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
      })

      // 10. Classify the error before cleanup: only retryable (5xx) errors
      // delete the WebhookEvent record. Permanent (4xx) failures keep the
      // record so a Stripe redelivery is a no-op and the failure stays
      // auditable in the DB. Response messages are static — raw error text
      // may embed query arguments (PII) and Stripe persists response bodies.
      let status: number
      let message: string

      if (
        errorMessage.includes('Missing signature') ||
        errorMessage.includes('verification failed') ||
        errorMessage.includes('Webhook verification failed') ||
        errorMessage.includes('Invalid webhook signature')
      ) {
        status = 401
        message = 'Invalid webhook signature'
      } else if (
        // Prisma errors must be classified before the string-based validation
        // check: their messages start with "Invalid `prisma...` invocation",
        // which would match the 'Invalid' branch below and return 400 —
        // Stripe would never retry a transient DB conflict (P2034, P2024)
        err instanceof Prisma.PrismaClientKnownRequestError ||
        err instanceof Prisma.PrismaClientUnknownRequestError ||
        err instanceof Prisma.PrismaClientRustPanicError ||
        err instanceof Prisma.PrismaClientInitializationError ||
        err instanceof Prisma.PrismaClientValidationError
      ) {
        status = 500
        message = 'Internal server error'
      } else if (
        // Validation errors (malformed data, missing required fields).
        // Stripe retries ALL non-2xx responses for up to 3 days; the kept
        // WebhookEvent record makes the next retry a 200-skip, which stops
        // the retry cycle after one redelivery
        errorMessage.includes('Invalid') ||
        errorMessage.includes('Missing') ||
        errorMessage.includes('Required')
      ) {
        status = 400
        message = 'Validation error'
      } else if (
        // Database/connection errors should return 500 - Stripe WILL retry
        errorMessage.toLowerCase().includes('database') ||
        errorMessage.toLowerCase().includes('connection') ||
        errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.toLowerCase().includes('prisma')
      ) {
        status = 500
        message = 'Internal server error'
      } else {
        // Default: 500 for unknown server errors (Stripe WILL retry)
        status = 500
        message = 'Webhook processing error'
      }

      // 11. Cleanup webhook event record on retryable errors (allows retry)
      // Only delete if WE created it — guards against deleting another concurrent request's record
      if (status >= 500 && eventId && eventRecordCreated) {
        try {
          await deleteWebhookEventByIdAndSource(eventId, source)
          logger.info({ eventId }, 'Cleaned up webhook event for retry')
        } catch (deleteErr) {
          // Ignore delete errors - event may not have been created yet
          logger.warn({ err: deleteErr }, 'Failed to cleanup webhook event')
        }
      }

      return NextResponse.json({ message }, { status })
    }
  }
}
