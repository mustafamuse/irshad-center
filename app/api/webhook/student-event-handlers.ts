import type { Stripe } from 'stripe'

import { createStubbedWebhookHandler } from '@/lib/utils/stub-helpers'

/**
 * Student Event Handlers for Webhooks
 *
 * IMPORTANT: These handlers need migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

export const syncStudentSubscriptionState = createStubbedWebhookHandler<
  [string]
>({ feature: 'syncStudentSubscriptionState', reason: 'schema_migration' })

export const handleCheckoutSessionCompleted = createStubbedWebhookHandler<
  [Stripe.Event]
>({ feature: 'handleCheckoutSessionCompleted', reason: 'schema_migration' })

export const handleInvoicePaymentSucceeded = createStubbedWebhookHandler<
  [Stripe.Event]
>({ feature: 'handleInvoicePaymentSucceeded', reason: 'schema_migration' })

export const handleInvoicePaymentFailed = createStubbedWebhookHandler<
  [Stripe.Event]
>({ feature: 'handleInvoicePaymentFailed', reason: 'schema_migration' })

export const handleSubscriptionUpdated = createStubbedWebhookHandler<
  [Stripe.Event]
>({ feature: 'handleSubscriptionUpdated', reason: 'schema_migration' })

export const handleSubscriptionDeleted = createStubbedWebhookHandler<
  [Stripe.Event]
>({ feature: 'handleSubscriptionDeleted', reason: 'schema_migration' })
