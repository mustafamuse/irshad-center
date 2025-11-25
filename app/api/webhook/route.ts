import { createWebhookHandler } from '@/lib/services/webhooks/base-webhook-handler'
import { verifyMahadWebhook } from '@/lib/stripe-mahad'

import {
  handleCheckoutSessionCompleted,
  handleInvoicePaymentSucceeded,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
  handleInvoicePaymentFailed,
} from './student-event-handlers'

/**
 * Main webhook handler for Mahad Stripe events.
 * Created using base webhook handler factory.
 */
export const POST = createWebhookHandler({
  source: 'mahad',
  verifyWebhook: verifyMahadWebhook,
  eventHandlers: {
    'checkout.session.completed': handleCheckoutSessionCompleted,
    'invoice.payment_succeeded': handleInvoicePaymentSucceeded,
    'invoice.payment_failed': handleInvoicePaymentFailed,
    'customer.subscription.updated': handleSubscriptionUpdated,
    'customer.subscription.deleted': handleSubscriptionDeleted,
  },
})

export const dynamic = 'force-dynamic'
