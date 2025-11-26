/**
 * Dugsi Webhook Handler
 *
 * Handles Stripe webhook events for the Dugsi program.
 * Uses the shared base handler for DRY implementation.
 *
 * Note: Dugsi uses a separate Stripe account from Mahad.
 */

import { STRIPE_WEBHOOK_EVENTS } from '@/lib/constants/stripe'
import { createWebhookHandler } from '@/lib/services/webhooks/base-webhook-handler'
import { dugsiEventHandlers } from '@/lib/services/webhooks/event-handlers'
import { verifyDugsiWebhook } from '@/lib/stripe-dugsi'

/**
 * POST handler for Dugsi webhooks
 */
export const POST = createWebhookHandler({
  source: 'dugsi',
  verifyWebhook: verifyDugsiWebhook,
  eventHandlers: {
    [STRIPE_WEBHOOK_EVENTS.CHECKOUT_COMPLETED]:
      dugsiEventHandlers['checkout.session.completed'],
    [STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_CREATED]:
      dugsiEventHandlers['customer.subscription.created'],
    [STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED]:
      dugsiEventHandlers['customer.subscription.updated'],
    [STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_DELETED]:
      dugsiEventHandlers['customer.subscription.deleted'],
    [STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED]:
      dugsiEventHandlers['invoice.payment_succeeded'],
    [STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED]:
      dugsiEventHandlers['invoice.payment_failed'],
    [STRIPE_WEBHOOK_EVENTS.INVOICE_FINALIZED]:
      dugsiEventHandlers['invoice.finalized'],
  },
})

export const dynamic = 'force-dynamic'
