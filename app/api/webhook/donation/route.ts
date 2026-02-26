import { STRIPE_WEBHOOK_EVENTS } from '@/lib/constants/stripe'
import { createWebhookHandler } from '@/lib/services/webhooks/base-webhook-handler'
import { donationEventHandlers } from '@/lib/services/webhooks/event-handlers'
import { verifyDonationWebhook } from '@/lib/stripe-donation'

export const POST = createWebhookHandler({
  source: 'donation',
  verifyWebhook: verifyDonationWebhook,
  eventHandlers: {
    [STRIPE_WEBHOOK_EVENTS.CHECKOUT_COMPLETED]:
      donationEventHandlers['checkout.session.completed'],
    [STRIPE_WEBHOOK_EVENTS.PAYMENT_SUCCEEDED]:
      donationEventHandlers['payment_intent.succeeded'],
    [STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_CREATED]:
      donationEventHandlers['customer.subscription.created'],
    [STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED]:
      donationEventHandlers['customer.subscription.updated'],
    [STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_DELETED]:
      donationEventHandlers['customer.subscription.deleted'],
    [STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED]:
      donationEventHandlers['invoice.payment_succeeded'],
    [STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED]:
      donationEventHandlers['invoice.payment_failed'],
    [STRIPE_WEBHOOK_EVENTS.INVOICE_FINALIZED]:
      donationEventHandlers['invoice.finalized'],
  },
})

export const dynamic = 'force-dynamic'
