/**
 * Mahad Webhook Handler
 *
 * Handles Stripe webhook events for the Mahad program.
 * Uses the shared base handler for DRY implementation.
 */

import { STRIPE_WEBHOOK_EVENTS } from '@/lib/constants/stripe'
import { createWebhookHandler } from '@/lib/services/webhooks/base-webhook-handler'
import { mahadEventHandlers } from '@/lib/services/webhooks/event-handlers'
import { stripeServerClient } from '@/lib/stripe'

/**
 * Verify Mahad webhook signature
 */
function verifyMahadWebhook(body: string, signature: string) {
  const webhookSecret =
    process.env.NODE_ENV === 'production'
      ? process.env.STRIPE_WEBHOOK_SECRET_PROD
      : process.env.STRIPE_WEBHOOK_SECRET_DEV

  if (!webhookSecret) {
    throw new Error('Missing Mahad webhook secret')
  }

  return stripeServerClient.webhooks.constructEvent(
    body,
    signature,
    webhookSecret
  )
}

/**
 * POST handler for Mahad webhooks
 */
export const POST = createWebhookHandler({
  source: 'mahad',
  verifyWebhook: verifyMahadWebhook,
  eventHandlers: {
    [STRIPE_WEBHOOK_EVENTS.CHECKOUT_COMPLETED]:
      mahadEventHandlers['checkout.session.completed'],
    [STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_CREATED]:
      mahadEventHandlers['customer.subscription.created'],
    [STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED]:
      mahadEventHandlers['customer.subscription.updated'],
    [STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_DELETED]:
      mahadEventHandlers['customer.subscription.deleted'],
    [STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED]:
      mahadEventHandlers['invoice.payment_succeeded'],
    [STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED]:
      mahadEventHandlers['invoice.payment_failed'],
    [STRIPE_WEBHOOK_EVENTS.INVOICE_FINALIZED]:
      mahadEventHandlers['invoice.finalized'],
  },
})

export const dynamic = 'force-dynamic'
