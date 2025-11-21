/**
 * Student Event Handlers (Mahad)
 *
 * Handles Stripe webhook events for Mahad subscriptions.
 * Migrated to use ProgramProfile/BillingAssignment model.
 */

import { SubscriptionStatus } from '@prisma/client'
import type { Stripe } from 'stripe'

import { prisma } from '@/lib/db'
import {
  getBillingAccountByStripeCustomerId,
  createSubscription,
  createBillingAssignment,
  updateBillingAssignmentStatus,
  updateSubscriptionStatus,
  getSubscriptionByStripeId,
  getBillingAssignmentsBySubscription,
  upsertBillingAccount,
} from '@/lib/db/queries/billing'
import { updateEnrollmentStatus } from '@/lib/db/queries/enrollment'
import { profileMatcher } from '@/lib/services/profile-matcher'
import { stripeServerClient as stripe } from '@/lib/stripe'
import { syncProfileSubscriptionState as syncProfileState } from '@/lib/utils/profile-updates'
import { extractPeriodDates, extractCustomerId } from '@/lib/utils/type-guards'

/**
 * The single source of truth for syncing a subscription from Stripe to our database.
 * This function fetches the latest subscription data from Stripe and updates the
 * corresponding profile records.
 * @param subscriptionId - The ID of the Stripe subscription to sync.
 */
export async function syncProfileSubscriptionState(subscriptionId: string) {
  console.log(
    `[WEBHOOK] Syncing subscription state for Subscription ID: ${subscriptionId}`
  )

  try {
    // Retrieve subscription from Stripe to get latest status
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

    console.log('✅ Subscription state synced successfully:', {
      subscriptionId,
      status: subscriptionStatus,
    })
  } catch (error) {
    console.error(
      `[WEBHOOK] Error syncing subscription state for ${subscriptionId}:`,
      error
    )
    throw error
  }
}

// Legacy export for backward compatibility
export const syncStudentSubscriptionState = syncProfileSubscriptionState

/**
 * Handles 'checkout.session.completed'
 * Finds a pre-registered profile and links them to their new Stripe subscription.
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
  const customerId = extractCustomerId(session.customer)

  if (!customerId) {
    console.error(
      `[WEBHOOK] Invalid customer ID in checkout session ${session.id}`
    )
    return
  }

  try {
    // Use profile matcher to find the profile
    const matchResult = await profileMatcher.findByCheckoutSession(
      session,
      'MAHAD_PROGRAM'
    )

    if (!matchResult.profile) {
      console.warn(
        `[WEBHOOK] No profile found for checkout session ${session.id} - manual review required`
      )
      return
    }

    const profile = matchResult.profile

    // Find or create billing account
    let billingAccount = await getBillingAccountByStripeCustomerId(
      customerId,
      'MAHAD'
    )

    if (!billingAccount) {
      // Create billing account if it doesn't exist
      billingAccount = await upsertBillingAccount({
        personId: profile.personId,
        accountType: 'MAHAD',
        stripeCustomerIdMahad: customerId,
      })
    }

    // Retrieve subscription from Stripe to get details
    const stripeSubscription =
      await stripe.subscriptions.retrieve(subscriptionId)

    const periodDates = extractPeriodDates(stripeSubscription)
    const subscriptionStatus = stripeSubscription.status as SubscriptionStatus
    const amount = stripeSubscription.items.data[0]?.price?.unit_amount || 0

    // Check if subscription already exists
    let subscriptionRecord = await getSubscriptionByStripeId(subscriptionId)

    if (!subscriptionRecord) {
      // Create new subscription
      subscriptionRecord = await createSubscription({
        billingAccountId: billingAccount.id,
        stripeAccountType: 'MAHAD',
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        status: subscriptionStatus,
        amount,
        currency: stripeSubscription.currency || 'usd',
        interval:
          stripeSubscription.items.data[0]?.price?.recurring?.interval ||
          'month',
        currentPeriodStart: periodDates.periodStart,
        currentPeriodEnd: periodDates.periodEnd,
        paidUntil: periodDates.periodEnd,
      })
    }

    // Create billing assignment linking subscription to profile
    const existingAssignments = await getBillingAssignmentsBySubscription(
      subscriptionRecord.id
    )
    const existingAssignment = existingAssignments.find(
      (a) => a.programProfileId === profile.id && a.isActive
    )

    if (!existingAssignment) {
      await createBillingAssignment({
        subscriptionId: subscriptionRecord.id,
        programProfileId: profile.id,
        amount,
      })

      console.log('✅ Created billing assignment:', {
        profileId: profile.id,
        subscriptionId: subscriptionRecord.id,
        sessionId: session.id,
      })
    }

    // Sync subscription state
    await syncProfileState(
      subscriptionId,
      subscriptionStatus,
      periodDates.periodStart,
      periodDates.periodEnd
    )
  } catch (error) {
    console.error(
      `[WEBHOOK] Error handling checkout session ${session.id}:`,
      error
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

  const subscription = (invoice as Record<string, unknown>)
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
    (line: unknown) =>
      (line as Record<string, unknown>).parent?.type ===
      'subscription_item_details'
  )

  if (!subscriptionLineItem?.period) {
    console.error(
      `[WEBHOOK] Error: Invoice ${invoice.id} is missing a subscription line item with period info. Check 'expand' and line item type.`
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

        console.log('✅ Created payment record:', {
          profileId: assignment.programProfileId,
          invoiceId: stripeInvoiceId,
          amount: assignment.amount,
        })
      }
    }
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
  console.log(
    `[WEBHOOK] Processing 'invoice.payment_failed' for Invoice ID: ${invoice.id}`
  )
  const subscriptionId = (invoice as Record<string, unknown>).subscription as
    | string
    | null

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

  const periodDates = extractPeriodDates(subscription)
  const subscriptionStatus = subscription.status as SubscriptionStatus

  // Update subscription record
  const subscriptionRecord = await getSubscriptionByStripeId(subscription.id)
  if (subscriptionRecord) {
    await updateSubscriptionStatus(subscriptionRecord.id, subscriptionStatus, {
      currentPeriodStart: periodDates.periodStart,
      currentPeriodEnd: periodDates.periodEnd,
      paidUntil: periodDates.periodEnd,
    })
  }

  // Sync profile state
  await syncProfileState(
    subscription.id,
    subscriptionStatus,
    periodDates.periodStart,
    periodDates.periodEnd
  )
}

/**
 * Handles 'customer.subscription.deleted' events.
 * Marks the subscription as canceled and unlinks it from the profiles.
 */
export async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  console.log(
    `[WEBHOOK] Processing 'customer.subscription.deleted' for Subscription ID: ${subscription.id}`
  )

  try {
    // Find subscription record
    const subscriptionRecord = await getSubscriptionByStripeId(subscription.id)

    if (!subscriptionRecord) {
      console.warn(
        `[WEBHOOK] Subscription ${subscription.id} not found in database - skipping deletion`
      )
      return
    }

    // Get all active billing assignments for this subscription
    const assignments = await getBillingAssignmentsBySubscription(
      subscriptionRecord.id
    )

    // Deactivate all billing assignments and update enrollment status
    for (const assignment of assignments) {
      if (assignment.isActive) {
        await updateBillingAssignmentStatus(assignment.id, false, new Date())

        // Update enrollment status to WITHDRAWN
        const activeEnrollment = await prisma.enrollment.findFirst({
          where: {
            programProfileId: assignment.programProfileId,
            status: { not: 'WITHDRAWN' },
            endDate: null,
          },
        })

        if (activeEnrollment) {
          await updateEnrollmentStatus(
            activeEnrollment.id,
            'WITHDRAWN',
            'Subscription canceled',
            new Date()
          )
        }

        console.log('✅ Deactivated billing assignment:', {
          assignmentId: assignment.id,
          profileId: assignment.programProfileId,
        })
      }
    }

    // Update subscription status to canceled
    await updateSubscriptionStatus(subscriptionRecord.id, 'canceled')

    console.log('✅ Subscription deleted successfully:', {
      subscriptionId: subscriptionRecord.id,
      assignmentsDeactivated: assignments.length,
    })
  } catch (error) {
    console.error(
      `[WEBHOOK] Error handling subscription deletion ${subscription.id}:`,
      error
    )
    throw error
  }
}
