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

import type { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'

import { prisma } from '@/lib/db'
import {
  RateMismatchError,
  RetryableWebhookError,
} from '@/lib/errors/webhook-errors'
import { createWebhookLogger } from '@/lib/logger'

/**
 * Webhook source identifier
 */
export type WebhookSource = 'mahad' | 'dugsi'

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
        const errorMessage =
          verificationError instanceof Error
            ? verificationError.message
            : 'Unknown verification error'
        logger.error({ error: errorMessage }, 'Webhook verification failed')
        return NextResponse.json(
          { message: 'Invalid webhook signature' },
          { status: 401 }
        )
      }

      eventId = event.id

      logger.info({ eventType: event.type, eventId }, 'Webhook received')

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
        async () =>
          await prisma.webhookEvent.findUnique({
            where: {
              eventId_source: {
                eventId: event.id,
                source,
              },
            },
          })
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
        logger.error(
          { err: parseError },
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
          await prisma.webhookEvent.create({
            data: {
              eventId: event.id,
              eventType: event.type,
              source,
              payload,
            },
          })
      )

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
        logger.info({ eventType: event.type }, 'Successfully processed event')
      } else {
        logger.warn({ eventType: event.type }, 'Unhandled event type')
      }

      return NextResponse.json({ received: true }, { status: 200 })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      const isRetryable = err instanceof RetryableWebhookError

      if (isRetryable) {
        logger.warn(
          {
            eventId,
            context: (err as RetryableWebhookError).context,
          },
          errorMessage
        )
      } else {
        logger.error(
          {
            err,
            eventId,
            errorType: err?.constructor?.name,
          },
          'Webhook error'
        )
      }

      // 10. Cleanup webhook event record on error (allows retry)
      // Don't delete if error is about duplicate processing
      if (eventId && !errorMessage.includes('already processed')) {
        try {
          await prisma.webhookEvent.delete({
            where: {
              eventId_source: {
                eventId,
                source,
              },
            },
          })
          logger.info({ eventId }, 'Cleaned up webhook event for retry')
        } catch (deleteErr) {
          // Ignore delete errors - event may not have been created yet
          logger.warn({ err: deleteErr }, 'Failed to cleanup webhook event')
        }
      }

      // 11. Return appropriate status codes based on error type

      // Retryable errors: expected race conditions, return 500 for Stripe retry
      if (isRetryable) {
        return NextResponse.json(
          { message: 'Temporary processing error, will retry' },
          { status: 500 }
        )
      }

      // Rate mismatch errors: billing discrepancy requiring investigation
      // Return 400 (no retry) since manual intervention is needed
      if (err instanceof RateMismatchError) {
        return NextResponse.json(
          { message: 'Rate validation failed - investigation required' },
          { status: 400 }
        )
      }

      // Signature and validation errors should return 400/401 (client errors)
      if (
        errorMessage.includes('Missing signature') ||
        errorMessage.includes('verification failed') ||
        errorMessage.includes('Webhook verification failed') ||
        errorMessage.includes('Invalid webhook signature')
      ) {
        return NextResponse.json(
          { message: 'Invalid webhook signature' },
          { status: 401 }
        )
      }

      // Validation errors (malformed data, missing required fields)
      // Return 400 for client errors - Stripe will NOT retry these
      if (
        errorMessage.includes('Invalid') ||
        errorMessage.includes('Missing') ||
        errorMessage.includes('Required')
      ) {
        return NextResponse.json(
          { message: `Validation error: ${errorMessage}` },
          { status: 400 }
        )
      }

      // Database/connection errors should return 500 - Stripe WILL retry
      if (
        errorMessage.toLowerCase().includes('database') ||
        errorMessage.toLowerCase().includes('connection') ||
        errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.toLowerCase().includes('prisma')
      ) {
        return NextResponse.json(
          { message: 'Internal server error' },
          { status: 500 }
        )
      }

      // Default: 500 for unknown server errors (Stripe WILL retry)
      // Changed from 400 to ensure transient errors are retried
      return NextResponse.json(
        { message: 'Webhook processing error' },
        { status: 500 }
      )
    }
  }
}
