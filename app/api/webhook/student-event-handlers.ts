import type { Stripe } from 'stripe'

import { logger } from '@/lib/logger'

/**
 * Student Event Handlers for Webhooks
 *
 * IMPORTANT: These handlers need migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

export async function syncStudentSubscriptionState(_subscriptionId: string) {
  logger.warn(
    { handler: 'syncStudentSubscriptionState', reason: 'schema_migration' },
    'Webhook handler disabled'
  )
  throw new Error('Webhook handlers need migration to new schema')
}

export async function handleCheckoutSessionCompleted(_event: Stripe.Event) {
  logger.warn(
    { handler: 'handleCheckoutSessionCompleted', reason: 'schema_migration' },
    'Webhook handler disabled'
  )
  throw new Error('Webhook handlers need migration to new schema')
}

export async function handleInvoicePaymentSucceeded(_event: Stripe.Event) {
  logger.warn(
    { handler: 'handleInvoicePaymentSucceeded', reason: 'schema_migration' },
    'Webhook handler disabled'
  )
  throw new Error('Webhook handlers need migration to new schema')
}

export async function handleInvoicePaymentFailed(_event: Stripe.Event) {
  logger.warn(
    { handler: 'handleInvoicePaymentFailed', reason: 'schema_migration' },
    'Webhook handler disabled'
  )
  throw new Error('Webhook handlers need migration to new schema')
}

export async function handleSubscriptionUpdated(_event: Stripe.Event) {
  logger.warn(
    { handler: 'handleSubscriptionUpdated', reason: 'schema_migration' },
    'Webhook handler disabled'
  )
  throw new Error('Webhook handlers need migration to new schema')
}

export async function handleSubscriptionDeleted(_event: Stripe.Event) {
  logger.warn(
    { handler: 'handleSubscriptionDeleted', reason: 'schema_migration' },
    'Webhook handler disabled'
  )
  throw new Error('Webhook handlers need migration to new schema')
}
