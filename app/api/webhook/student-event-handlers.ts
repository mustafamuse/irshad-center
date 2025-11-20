/**
 * ⚠️ CRITICAL MIGRATION NEEDED:
 * This file uses the legacy Student model which has been removed.
 * All functions need to be migrated to:
 * - Subscription/BillingAssignment model for subscription management
 * - ProgramProfile/Enrollment model for student records
 * - Person model for customer identification
 */

import type { Stripe } from 'stripe'

import { prisma } from '@/lib/db'
import { getNewStudentStatus } from '@/lib/queries/subscriptions'
import { studentMatcher } from '@/lib/services/student-matcher'
import { stripeServerClient as stripe } from '@/lib/stripe'
import {
  updateStudentsInTransaction,
  buildCancellationUpdateData,
} from '@/lib/utils/student-updates'
import { extractPeriodDates } from '@/lib/utils/type-guards'

/**
 * The single source of truth for syncing a subscription from Stripe to our database.
 * This function fetches the latest subscription data from Stripe and updates the
 * corresponding student records.
 * @param subscriptionId - The ID of the Stripe subscription to sync.
 * 
 * TODO: Migrate to Subscription/BillingAssignment model - Student model removed
 */
export async function syncStudentSubscriptionState(subscriptionId: string) {
  console.warn(
    `[WEBHOOK] syncStudentSubscriptionState: Migration needed for Subscription ID: ${subscriptionId}`
  )
  // TODO: Migrate to Subscription/BillingAssignment model - Student model removed
  // Stub: Return without updating database
}

/**
 * Handles 'checkout.session.completed'
 * Finds a pre-registered student and links them to their new Stripe subscription.
 * This is the primary mechanism for onboarding a new paying student.
 */
export async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session
  console.log(
    `[WEBHOOK] Processing 'checkout.session.completed' for Session ID: ${session.id}`
  )

  // Exit if this checkout session didn't create a subscription
  if (
    session.mode !== 'subscription' ||
    !session.subscription ||
    !session.customer
  ) {
    console.log(
      `[WEBHOOK] Checkout session ${session.id} is not a subscription creation event. Skipping.`
    )
    return
  }

  const subscriptionId = session.subscription as string

  // TODO: Migrate to Subscription/BillingAssignment/ProgramProfile model - Student model removed
  console.warn(
    `[WEBHOOK] Checkout session completed - Migration needed for Session ID: ${session.id}, Subscription ID: ${subscriptionId}`
  )
  // Stub: Return without updating database
}

/**
 * Handles 'invoice.payment_succeeded'.
 * Creates a permanent, auditable `StudentPayment` record and then triggers a state sync.
 */
export async function handleInvoicePaymentSucceeded(event: Stripe.Event) {
  const invoicePayload = event.data.object as Stripe.Invoice
  const stripeInvoiceId = invoicePayload.id
  console.log(
    `[WEBHOOK] Processing 'invoice.payment_succeeded' for Invoice ID: ${stripeInvoiceId}`
  )

  if (!stripeInvoiceId) {
    console.error('[WEBHOOK] Received an invoice event with no ID. Skipping.')
    return
  }

  // Retrieve the full invoice from Stripe first to get all necessary data.
  let invoice: Stripe.Invoice
  try {
    invoice = await stripe.invoices.retrieve(stripeInvoiceId, {
      expand: ['lines.data', 'subscription'],
    })
  } catch (error) {
    console.error(
      `[WEBHOOK] Failed to retrieve invoice ${stripeInvoiceId} from Stripe:`,
      error
    )
    return
  }

  const subscription = (invoice as any)
    .subscription as Stripe.Subscription | null

  if (!subscription) {
    console.log(
      `[WEBHOOK] Invoice ${invoice.id} succeeded but is not tied to a subscription. Skipping payment record creation.`
    )
    return
  }

  // --- Start of Transactional Record Creation ---
  // This part remains, as it's about logging a historical event, not just current state.

  const subscriptionLineItem = invoice.lines.data.find(
    (line: any) => line.parent?.type === 'subscription_item_details'
  )

  if (!subscriptionLineItem?.period) {
    console.error(
      `[WEBHOOK] Error: Invoice ${invoice.id} is missing a subscription line item with period info. Check 'expand' and line item type.`
    )
    return
  }

  // TODO: Migrate to StudentPayment/BillingAssignment/ProgramProfile model - Student model removed
  console.warn(
    `[WEBHOOK] Invoice payment succeeded - Migration needed for Invoice ID: ${stripeInvoiceId}, Subscription ID: ${subscription.id}`
  )
  // Stub: Return without creating payment records
  // --- End of Transactional Record Creation ---

  // After creating the historical record, sync the student's state from the subscription.
  await syncStudentSubscriptionState(subscription.id)
}

/**
 * Handles 'invoice.payment_failed' event.
 * Syncs the subscription state, which will be 'past_due'.
 * Optionally, you can add specific logic here, like creating a late fee.
 */
export async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  console.log(
    `[WEBHOOK] Processing 'invoice.payment_failed' for Invoice ID: ${invoice.id}`
  )
  const subscriptionId = (invoice as any).subscription as string | null

  if (subscriptionId) {
    await syncStudentSubscriptionState(subscriptionId)
  }

  // --- Optional: Late Fee Logic ---
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
    console.log(
      `[WEBHOOK] Successfully created a pending late fee for Customer ID: ${customerId}.`
    )
  }
}

/**
 * Handles 'customer.subscription.updated' events.
 * This is now a simple wrapper around our sync function.
 */
export async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  console.log(
    `[WEBHOOK] Processing 'customer.subscription.updated' for Subscription ID: ${subscription.id}`
  )
  await syncStudentSubscriptionState(subscription.id)
}

/**
 * Handles 'customer.subscription.deleted' events.
 * Marks the subscription as canceled and unlinks it from the students.
 */
export async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  console.log(
    `[WEBHOOK] Processing 'customer.subscription.deleted' for Subscription ID: ${subscription.id}`
  )

  // TODO: Migrate to Subscription/BillingAssignment model - Student model removed
  console.warn(
    `[WEBHOOK] Subscription deleted - Migration needed for Subscription ID: ${subscription.id}`
  )
  // Stub: Return without updating database
}
