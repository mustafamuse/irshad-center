/**
 * WebhookEvent Query Functions
 *
 * Idempotency bookkeeping for Stripe webhook processing (rule 12).
 * WebhookEvent is append-only by design; the delete below exists solely so
 * a failed handler can release its own record for retry.
 */

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

/**
 * Webhook source identifier. Idempotency is namespaced per source via the
 * (eventId, source) composite key — a wrong source would let an event
 * reprocess, so this stays a closed union, not string.
 */
export type WebhookSource = 'mahad' | 'dugsi' | 'donation'

/**
 * Find a processed webhook event by its Stripe event ID and source program.
 * @param client - Optional database client (for transaction support)
 */
export async function findWebhookEventByIdAndSource(
  eventId: string,
  source: WebhookSource,
  client: DatabaseClient = prisma
) {
  return client.webhookEvent.findUnique({
    where: {
      eventId_source: {
        eventId,
        source,
      },
    },
  })
}

/**
 * Record a webhook event immediately after signature verification, before
 * business logic (rule 12).
 * @param client - Optional database client (for transaction support)
 */
export async function createWebhookEventRecord(
  data: {
    eventId: string
    eventType: string
    source: WebhookSource
    payload: Prisma.InputJsonValue
  },
  client: DatabaseClient = prisma
) {
  return client.webhookEvent.create({ data })
}

/**
 * Delete a webhook event record so Stripe's retry can reprocess it. Only
 * called by the handler that created the record in the same request.
 * @param client - Optional database client (for transaction support)
 */
export async function deleteWebhookEventByIdAndSource(
  eventId: string,
  source: WebhookSource,
  client: DatabaseClient = prisma
) {
  return client.webhookEvent.delete({
    where: {
      eventId_source: {
        eventId,
        source,
      },
    },
  })
}
