/**
 * Stripe Constants
 *
 * Centralized constants for Stripe integration
 */

/**
 * Custom field keys used in Stripe Checkout sessions.
 * These are configured in the Stripe Dashboard under Payment Links / Checkout settings.
 */
export const STRIPE_CUSTOM_FIELDS = {
  /** Student's email address (the one used for registration) */
  STUDENT_EMAIL: 'studentsemailonethatyouusedtoregister',
  /** Student's WhatsApp number (for group communications) */
  STUDENT_PHONE: 'studentswhatsappthatyouuseforourgroup',
} as const

/**
 * Stripe subscription statuses
 */
export const STRIPE_SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  UNPAID: 'unpaid',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
  PAUSED: 'paused',
} as const

/**
 * Stripe webhook event types we handle
 */
export const STRIPE_WEBHOOK_EVENTS = {
  CHECKOUT_COMPLETED: 'checkout.session.completed',
  SUBSCRIPTION_CREATED: 'customer.subscription.created',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  INVOICE_FINALIZED: 'invoice.finalized',
  INVOICE_PAID: 'invoice.paid',
  PAYMENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_FAILED: 'payment_intent.payment_failed',
} as const
