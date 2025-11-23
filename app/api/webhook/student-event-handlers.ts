/**
 * Student Event Handlers (Mahad)
 *
 * Refactored to use webhook service for DRY architecture.
 * Handles Stripe webhook events for Mahad subscriptions.
 *
 * Responsibilities:
 * - Route webhook events to appropriate handlers
 * - Handle Mahad-specific logic (StudentPayment records, profile status updates)
 * - Delegate common operations to webhook service
 */

import { SubscriptionStatus } from '@prisma/client'
import type { Stripe } from 'stripe'
import * as Sentry from '@sentry/nextjs'

import { prisma } from '@/lib/db'
import {
  getSubscriptionByStripeId,
  getBillingAssignmentsBySubscription,
  updateSubscriptionStatus,
} from '@/lib/db/queries/billing'
import { createWebhookLogger } from '@/lib/logger'
import { handleSubscriptionCancellationEnrollments } from '@/lib/services/shared/enrollment-service'
import { unifiedMatcher } from '@/lib/services/shared/unified-matcher'
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated as handleSubscriptionUpdatedService,
  handleSubscriptionDeleted as handleSubscriptionDeletedService,
} from '@/lib/services/webhooks/webhook-service'
import { getMahadStripeClient } from '@/lib/stripe-mahad'
import { syncProfileSubscriptionState as syncProfileState } from '@/lib/utils/profile-updates'
import { extractPeriodDates, extractCustomerId } from '@/lib/utils/type-guards'

const logger = createWebhookLogger('mahad')

/**
 * The single source of truth for syncing a subscription from Stripe to our database.
 * This function fetches the latest subscription data from Stripe and updates the
 * corresponding profile records.
 * @param subscriptionId - The ID of the Stripe subscription to sync.
 */
export async function syncProfileSubscriptionState(subscriptionId: string) {
  logger.info(
    { subscriptionId },
    'Syncing subscription state'
  )

  try {
    // Retrieve subscription from Stripe to get latest status
    const stripe = getMahadStripeClient()
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscriptionId,
      {
        expand: ['latest_invoice'],
      }
    )

    const periodDates = extractPeriodDates(stripeSubscription)
    const subscriptionStatus = stripeSubscription.status as SubscriptionStatus

    // Sync using the utility function
    await syncProfileState(
      subscriptionId,
      subscriptionStatus,
      periodDates.periodStart,
      periodDates.periodEnd
    )

    logger.info(
      {
        subscriptionId,
        status: subscriptionStatus,
      },
      'Subscription state synced successfully'
    )
  } catch (error) {
    logger.error(
      { err: error, subscriptionId },
      'Error syncing subscription state'
    )
    throw error
  }
}

// Legacy export for backward compatibility
export const syncStudentSubscriptionState = syncProfileSubscriptionState

/**
 * Handles 'checkout.session.completed'
 *
 * Mahad-specific logic:
 * - Use profile matcher to find pre-registered profile
 * - Delegate subscription creation to service
 * - Sync profile state (Mahad-specific)
 */
export async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session
  logger.info(
    { sessionId: session.id, eventType: 'checkout.session.completed' },
    'Processing checkout session completed'
  )

  // Exit if this checkout session didn't create a subscription
  if (
    session.mode !== 'subscription' ||
    !session.subscription ||
    !session.customer
  ) {
    logger.info(
      { sessionId: session.id },
      'Checkout session is not a subscription creation event, skipping'
    )
    return
  }

  const subscriptionId = session.subscription as string
  const customerId = extractCustomerId(session.customer)

  if (!customerId) {
    logger.error(
      { sessionId: session.id },
      'Invalid customer ID in checkout session'
    )
    return
  }

  try {
    const stripe = getMahadStripeClient()

    // Use unified matcher to find the profile (Mahad-specific)
    const matchResult = await Sentry.startSpan(
      {
        name: 'matcher.find_by_checkout_session',
        op: 'matcher.search',
        attributes: {
          session_id: session.id,
          program: 'MAHAD',
        },
      },
      async () =>
        await unifiedMatcher.findByCheckoutSession(session, 'MAHAD')
    )

    if (!matchResult.programProfile) {
      logger.warn(
        { sessionId: session.id },
        'No profile found for checkout session - manual review required'
      )
      return
    }

    const profile = matchResult.programProfile

    // Retrieve subscription from Stripe
    const stripeSubscription = await Sentry.startSpan(
      {
        name: 'stripe.retrieve_subscription',
        op: 'stripe.api',
        attributes: {
          subscription_id: subscriptionId,
        },
      },
      async () => await stripe.subscriptions.retrieve(subscriptionId)
    )

    // Delegate to webhook service for subscription creation
    const result = await Sentry.startSpan(
      {
        name: 'webhook.create_subscription',
        op: 'webhook.processing',
        attributes: {
          program: 'MAHAD',
          profile_id: profile.id,
          subscription_id: subscriptionId,
        },
      },
      async () =>
        await handleSubscriptionCreated(stripeSubscription, 'MAHAD', [
          profile.id,
        ])
    )

    logger.info(
      {
        profileId: profile.id,
        subscriptionId: result.subscriptionId,
        sessionId: session.id,
      },
      'Subscription created via checkout session'
    )

    // Sync profile state (Mahad-specific utility)
    const periodDates = extractPeriodDates(stripeSubscription)
    await Sentry.startSpan(
      {
        name: 'profile.sync_subscription_state',
        op: 'db.transaction',
        attributes: {
          subscription_id: subscriptionId,
          status: stripeSubscription.status,
        },
      },
      async () =>
        await syncProfileState(
          subscriptionId,
          stripeSubscription.status as SubscriptionStatus,
          periodDates.periodStart,
          periodDates.periodEnd
        )
    )
  } catch (error) {
    logger.error(
      { err: error, sessionId: session.id },
      'Error handling checkout session'
    )
    throw error
  }
}

/**
 * Handles 'invoice.payment_succeeded'.
 * Creates a permanent, auditable `StudentPayment` record and then triggers a state sync.
 */
export async function handleInvoicePaymentSucceeded(event: Stripe.Event) {
  const invoicePayload = event.data.object as Stripe.Invoice
  const stripeInvoiceId = invoicePayload.id
  logger.info(
    { invoiceId: stripeInvoiceId, eventType: 'invoice.payment_succeeded' },
    'Processing invoice payment succeeded'
  )

  if (!stripeInvoiceId) {
    logger.error('Received an invoice event with no ID, skipping')
    return
  }

  // Retrieve the full invoice from Stripe first to get all necessary data.
  const stripe = getMahadStripeClient()
  let invoice: Stripe.Invoice
  try {
    invoice = await Sentry.startSpan(
      {
        name: 'stripe.retrieve_invoice',
        op: 'stripe.api',
        attributes: {
          invoice_id: stripeInvoiceId,
        },
      },
      async () =>
        await stripe.invoices.retrieve(stripeInvoiceId, {
          expand: ['lines.data', 'subscription'],
        })
    )
  } catch (error) {
    logger.error(
      { err: error, invoiceId: stripeInvoiceId },
      'Failed to retrieve invoice from Stripe'
    )
    return
  }

  const subscription = (invoice as unknown as Record<string, unknown>)
    .subscription as Stripe.Subscription | null

  if (!subscription) {
    logger.info(
      { invoiceId: invoice.id },
      'Invoice succeeded but is not tied to a subscription, skipping payment record creation'
    )
    return
  }

  // --- Start of Transactional Record Creation ---
  // This part remains, as it's about logging a historical event, not just current state.

  const subscriptionLineItem = invoice.lines.data.find(
    (line: unknown) =>
      (
        (line as unknown as Record<string, unknown>)
          .parent as unknown as Record<string, unknown>
      )?.type === 'subscription_item_details'
  )

  if (!subscriptionLineItem?.period) {
    logger.error(
      { invoiceId: invoice.id },
      'Invoice is missing a subscription line item with period info'
    )
    return
  }

  // Create StudentPayment record for each profile linked to this subscription
  const subscriptionRecord = await getSubscriptionByStripeId(subscription.id)

  if (subscriptionRecord) {
    const assignments = await getBillingAssignmentsBySubscription(
      subscriptionRecord.id
    )

    const period = subscriptionLineItem.period
    const year = new Date(period.start * 1000).getFullYear()
    const month = new Date(period.start * 1000).getMonth() + 1
    const _amountPaid = invoice.amount_paid || 0
    const paidAtTimestamp = invoice.status_transitions?.paid_at
    const paidAt = new Date(
      paidAtTimestamp ? paidAtTimestamp * 1000 : Date.now()
    )

    // Create payment record for each active assignment
    await Sentry.startSpan(
      {
        name: 'payment.create_records',
        op: 'db.transaction',
        attributes: {
          invoice_id: stripeInvoiceId,
          subscription_id: subscription.id,
          num_assignments: assignments.filter((a) => a.isActive).length,
        },
      },
      async () => {
        for (const assignment of assignments.filter((a) => a.isActive)) {
          // Check if payment record already exists
          const existingPayment = await prisma.studentPayment.findUnique({
            where: {
              programProfileId_stripeInvoiceId: {
                programProfileId: assignment.programProfileId,
                stripeInvoiceId: stripeInvoiceId,
              },
            },
          })

          if (!existingPayment) {
            await prisma.studentPayment.create({
              data: {
                programProfileId: assignment.programProfileId,
                year,
                month,
                amountPaid: assignment.amount,
                paidAt,
                stripeInvoiceId: stripeInvoiceId,
              },
            })

            logger.info(
              {
                profileId: assignment.programProfileId,
                invoiceId: stripeInvoiceId,
                amount: assignment.amount,
              },
              'Created payment record'
            )
          }
        }
      }
    )
  }

  // --- End of Transactional Record Creation ---

  // After creating the historical record, sync the profile's state from the subscription.
  await syncProfileSubscriptionState(subscription.id)
}

/**
 * Handles 'invoice.payment_failed' event.
 * Syncs the subscription state, which will be 'past_due'.
 * Optionally, you can add specific logic here, like creating a late fee.
 */
export async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  logger.info(
    { invoiceId: invoice.id, eventType: 'invoice.payment_failed' },
    'Processing invoice payment failed'
  )
  const subscriptionId = (invoice as unknown as Record<string, unknown>)
    .subscription as string | null

  if (subscriptionId) {
    // Update subscription status to past_due
    const subscriptionRecord = await getSubscriptionByStripeId(subscriptionId)
    if (subscriptionRecord) {
      await updateSubscriptionStatus(subscriptionRecord.id, 'past_due')
    }

    // Sync profile state
    await syncProfileState(subscriptionId, 'past_due', null, null)
  }

  // --- Optional: Late Fee Logic ---
  const stripe = getMahadStripeClient()
  const customerId = invoice.customer
  if (typeof customerId !== 'string') {
    return
  }
  const failedInvoiceMonth = new Date(invoice.created * 1000).toLocaleString(
    'default',
    { month: 'long', year: 'numeric' }
  )
  const dynamicDescription = `${failedInvoiceMonth} Failed Payment Fee`

  const existingItems = await stripe.invoiceItems.list({
    customer: customerId,
    pending: true,
  })

  const hasLateFee = existingItems.data.some(
    (item: Stripe.InvoiceItem) => item.description === dynamicDescription
  )

  if (!hasLateFee) {
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: 1000,
      currency: 'usd',
      description: dynamicDescription,
    })
    logger.info(
      { customerId },
      'Successfully created a pending late fee'
    )
  }
}

/**
 * Handles 'customer.subscription.updated' events.
 *
 * Delegates to service for status update, then syncs profile state (Mahad-specific).
 */
export async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  logger.info(
    { subscriptionId: subscription.id, eventType: 'customer.subscription.updated' },
    'Processing subscription updated'
  )

  try {
    // Delegate to webhook service for subscription update
    const result = await handleSubscriptionUpdatedService(subscription)

    logger.info(
      {
        subscriptionId: result.subscriptionId,
        status: result.status,
      },
      'Subscription updated'
    )

    // Sync profile state (Mahad-specific utility)
    const periodDates = extractPeriodDates(subscription)
    await syncProfileState(
      subscription.id,
      subscription.status as SubscriptionStatus,
      periodDates.periodStart,
      periodDates.periodEnd
    )
  } catch (error) {
    logger.error(
      { err: error, subscriptionId: subscription.id },
      'Error handling subscription update'
    )
    throw error
  }
}

/**
 * Handles 'customer.subscription.deleted' events.
 *
 * Delegates to service for deactivation, then updates Mahad-specific enrollment status.
 */
export async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  logger.info(
    { subscriptionId: subscription.id, eventType: 'customer.subscription.deleted' },
    'Processing subscription deleted'
  )

  try {
    // Update enrollment status to WITHDRAWN BEFORE deleting subscription
    const enrollmentResult = await Sentry.startSpan(
      {
        name: 'enrollment.withdraw_for_subscription',
        op: 'db.transaction',
        attributes: {
          subscription_id: subscription.id,
        },
      },
      async () =>
        await handleSubscriptionCancellationEnrollments(
          subscription.id,
          'Subscription canceled'
        )
    )

    logger.info(
      {
        withdrawn: enrollmentResult.withdrawn,
        errors: enrollmentResult.errors.length,
      },
      'Updated enrollments to WITHDRAWN'
    )

    // Delegate to webhook service for subscription deletion
    const result = await handleSubscriptionDeletedService(subscription)

    logger.info(
      {
        subscriptionId: result.subscriptionId,
        enrollmentsWithdrawn: enrollmentResult.withdrawn,
      },
      'Subscription deleted successfully'
    )
  } catch (error) {
    logger.error(
      { err: error, subscriptionId: subscription.id },
      'Error handling subscription deletion'
    )
    throw error
  }
}
