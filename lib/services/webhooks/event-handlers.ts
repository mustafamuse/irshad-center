/**
 * Webhook Event Handlers
 *
 * Shared event handlers for Stripe webhooks.
 * Works for both Mahad and Dugsi programs.
 *
 * Uses:
 * - webhook-service.ts for subscription lifecycle operations
 * - unified-matcher.ts for matching checkout sessions to profiles
 */

import { StripeAccountType } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'

import { createServiceLogger } from '@/lib/logger'
import { unifiedMatcher } from '@/lib/services/shared/unified-matcher'

import {
  handlePaymentMethodCapture,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoiceFinalized,
} from './webhook-service'

const logger = createServiceLogger('webhook-handlers')

/**
 * Extract typed object from Stripe event
 */
function extractEventData<T>(event: Stripe.Event): T {
  return event.data.object as T
}

/**
 * Handle checkout.session.completed event
 *
 * - Captures payment method
 * - Links to billing account
 * - Creates subscription if present
 */
async function handleCheckoutCompleted(
  event: Stripe.Event,
  accountType: StripeAccountType
): Promise<void> {
  const session = extractEventData<Stripe.Checkout.Session>(event)

  logger.info(
    { sessionId: session.id, accountType },
    'Processing checkout.session.completed'
  )

  // Find matching profile/billing account
  const matchResult = await Sentry.startSpan(
    {
      name: 'webhook.match_checkout_session',
      op: 'business.logic',
      attributes: { session_id: session.id, account_type: accountType },
    },
    async () => await unifiedMatcher.findByCheckoutSession(session, accountType)
  )

  // Get person ID from match result
  const personId =
    matchResult.personId ||
    matchResult.billingAccount?.personId ||
    matchResult.programProfile?.personId ||
    null

  if (!personId) {
    // Log for manual review but don't fail
    unifiedMatcher.logNoMatchFound(
      session,
      session.subscription?.toString() || 'no-subscription',
      accountType
    )

    // Escalate to Sentry error for proper alerting
    // Customer paid but subscription cannot be linked automatically
    Sentry.captureMessage('Checkout session could not be matched to person', {
      level: 'error',
      extra: {
        sessionId: session.id,
        accountType,
        customerEmail: session.customer_details?.email,
        subscriptionId: session.subscription?.toString() || null,
        action: 'manual_linking_required',
      },
    })

    logger.warn(
      { sessionId: session.id, accountType },
      'No person found for checkout session - manual linking required'
    )
    return
  }

  // Capture payment method
  await handlePaymentMethodCapture(session, accountType, personId)

  // If subscription exists, create it
  if (session.subscription) {
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id

    logger.info(
      { sessionId: session.id, subscriptionId },
      'Checkout session has subscription - will be handled by subscription.created event'
    )
  }
}

/**
 * Handle customer.subscription.created event
 *
 * Creates subscription record and links to profiles
 */
async function handleSubscriptionCreatedEvent(
  event: Stripe.Event,
  accountType: StripeAccountType
): Promise<void> {
  const subscription = extractEventData<Stripe.Subscription>(event)

  logger.info(
    { subscriptionId: subscription.id, accountType },
    'Processing customer.subscription.created'
  )

  // Extract profile IDs from subscription metadata if available
  const profileIds = subscription.metadata?.profileIds
    ? subscription.metadata.profileIds.split(',').filter(Boolean)
    : subscription.metadata?.profileId
      ? [subscription.metadata.profileId]
      : undefined

  await handleSubscriptionCreated(subscription, accountType, profileIds)
}

/**
 * Handle customer.subscription.updated event
 *
 * Updates subscription status and period dates
 */
async function handleSubscriptionUpdatedEvent(
  event: Stripe.Event
): Promise<void> {
  const subscription = extractEventData<Stripe.Subscription>(event)

  logger.info(
    { subscriptionId: subscription.id, status: subscription.status },
    'Processing customer.subscription.updated'
  )

  await handleSubscriptionUpdated(subscription)
}

/**
 * Handle customer.subscription.deleted event
 *
 * Cancels subscription and unlinks from profiles
 */
async function handleSubscriptionDeletedEvent(
  event: Stripe.Event
): Promise<void> {
  const subscription = extractEventData<Stripe.Subscription>(event)

  logger.info(
    { subscriptionId: subscription.id },
    'Processing customer.subscription.deleted'
  )

  await handleSubscriptionDeleted(subscription)
}

/**
 * Handle invoice.payment_succeeded event
 *
 * Updates paidUntil date on subscription
 */
async function handleInvoicePaymentSucceededEvent(
  event: Stripe.Event
): Promise<void> {
  const invoice = extractEventData<Stripe.Invoice>(event)

  logger.info(
    { invoiceId: invoice.id, status: invoice.status },
    'Processing invoice.payment_succeeded'
  )

  await handleInvoiceFinalized(invoice)
}

/**
 * Handle invoice.payment_failed event
 *
 * Logs failure for monitoring - subscription status handled by subscription.updated
 */
async function handleInvoicePaymentFailedEvent(
  event: Stripe.Event
): Promise<void> {
  const invoice = extractEventData<Stripe.Invoice>(event)

  // Extract subscription ID (may be expanded object or string)
  const invoiceData = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription
  }
  const subscriptionId =
    typeof invoiceData.subscription === 'string'
      ? invoiceData.subscription
      : (invoiceData.subscription?.id ?? null)

  logger.warn(
    {
      invoiceId: invoice.id,
      subscriptionId,
      attemptCount: invoice.attempt_count,
      amountDue: invoice.amount_due,
    },
    'Invoice payment failed'
  )

  // Subscription status update will come via customer.subscription.updated event
  // Just log for alerting/monitoring purposes
  Sentry.captureMessage('Invoice payment failed', {
    level: 'warning',
    extra: {
      invoiceId: invoice.id,
      subscriptionId,
      attemptCount: invoice.attempt_count,
    },
  })
}

/**
 * Handle invoice.finalized event
 *
 * Updates paidUntil date on subscription
 */
async function handleInvoiceFinalizedEvent(event: Stripe.Event): Promise<void> {
  const invoice = extractEventData<Stripe.Invoice>(event)

  logger.info({ invoiceId: invoice.id }, 'Processing invoice.finalized')

  await handleInvoiceFinalized(invoice)
}

/**
 * Create event handlers for a specific account type.
 *
 * Factory function that generates handlers bound to an account type.
 * This enables DRY code sharing between Mahad and Dugsi webhooks.
 */
export function createEventHandlers(accountType: StripeAccountType) {
  return {
    'checkout.session.completed': (event: Stripe.Event) =>
      handleCheckoutCompleted(event, accountType),

    'customer.subscription.created': (event: Stripe.Event) =>
      handleSubscriptionCreatedEvent(event, accountType),

    'customer.subscription.updated': handleSubscriptionUpdatedEvent,

    'customer.subscription.deleted': handleSubscriptionDeletedEvent,

    'invoice.payment_succeeded': handleInvoicePaymentSucceededEvent,

    'invoice.payment_failed': handleInvoicePaymentFailedEvent,

    'invoice.finalized': handleInvoiceFinalizedEvent,
  }
}

// Pre-built handler sets for each program
export const mahadEventHandlers = createEventHandlers('MAHAD')
export const dugsiEventHandlers = createEventHandlers('DUGSI')
