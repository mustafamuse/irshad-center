import type { Stripe } from 'stripe'

/**
 * Student Event Handlers for Webhooks
 *
 * IMPORTANT: These handlers need migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

export async function syncStudentSubscriptionState(_subscriptionId: string) {
  console.error(
    '[WEBHOOK] syncStudentSubscriptionState: Disabled during schema migration'
  )
  throw new Error('Webhook handlers need migration to new schema')
}

export async function handleCheckoutSessionCompleted(_event: Stripe.Event) {
  console.error(
    '[WEBHOOK] handleCheckoutSessionCompleted: Disabled during schema migration'
  )
  throw new Error('Webhook handlers need migration to new schema')
}

export async function handleInvoicePaymentSucceeded(_event: Stripe.Event) {
  console.error(
    '[WEBHOOK] handleInvoicePaymentSucceeded: Disabled during schema migration'
  )
  throw new Error('Webhook handlers need migration to new schema')
}

export async function handleInvoicePaymentFailed(_event: Stripe.Event) {
  console.error(
    '[WEBHOOK] handleInvoicePaymentFailed: Disabled during schema migration'
  )
  throw new Error('Webhook handlers need migration to new schema')
}

export async function handleSubscriptionUpdated(_event: Stripe.Event) {
  console.error(
    '[WEBHOOK] handleSubscriptionUpdated: Disabled during schema migration'
  )
  throw new Error('Webhook handlers need migration to new schema')
}

export async function handleSubscriptionDeleted(_event: Stripe.Event) {
  console.error(
    '[WEBHOOK] handleSubscriptionDeleted: Disabled during schema migration'
  )
  throw new Error('Webhook handlers need migration to new schema')
}
