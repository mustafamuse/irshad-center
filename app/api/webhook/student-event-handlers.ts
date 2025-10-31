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
 */
export async function syncStudentSubscriptionState(subscriptionId: string) {
  console.log(
    `[WEBHOOK] syncStudentSubscriptionState: Starting sync for Subscription ID: ${subscriptionId}`
  )
  try {
    const subscription: Stripe.Subscription =
      await stripe.subscriptions.retrieve(subscriptionId)

    // Extract period dates
    const periodDates = extractPeriodDates(subscription)

    // Use transaction to ensure atomic updates of all students
    const updateResults = await prisma.$transaction(async (tx) => {
      // Find all students linked to this subscription
      const students = await tx.student.findMany({
        where: {
          stripeSubscriptionId: subscription.id,
          program: 'MAHAD_PROGRAM', // ✅ Prevent cross-contamination with Dugsi
        },
        select: {
          id: true,
          subscriptionStatus: true,
          stripeSubscriptionId: true,
        },
      })

      if (students.length === 0) {
        console.log(
          `[WEBHOOK] syncStudentSubscriptionState: No students found for Subscription ID: ${subscription.id}. Skipping sync.`
        )
        return []
      }

      // Update each student using centralized utility
      const updatePromises = updateStudentsInTransaction(
        students,
        {
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          newStudentStatus: getNewStudentStatus(subscription.status),
          periodStart: periodDates.periodStart,
          periodEnd: periodDates.periodEnd,
          program: 'MAHAD',
        },
        tx
      )

      return await Promise.all(updatePromises)
    })

    console.log(
      `[WEBHOOK] syncStudentSubscriptionState: Successfully synced Subscription ID: ${subscription.id}. Matched and updated ${updateResults.length} student(s) to status: ${subscription.status}.`
    )
  } catch (error) {
    console.error(
      `[WEBHOOK] syncStudentSubscriptionState: Error syncing Subscription ID: ${subscriptionId}.`,
      error
    )
  }
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

  // Idempotency Check: Prevent re-linking a subscription
  const existingStudent = await prisma.student.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  })

  if (existingStudent) {
    console.log(
      `[WEBHOOK] Student ${existingStudent.id} is already linked to subscription ${subscriptionId}. Skipping.`
    )
    return
  }

  // Use the StudentMatcher service to find the student
  const matchResult = await studentMatcher.findByCheckoutSession(session)

  if (matchResult.student) {
    const oldSubscriptionId = matchResult.student.stripeSubscriptionId
    const updateData: any = {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscriptionId,
      // Don't set status here - let syncStudentSubscriptionState handle it
      // based on the actual Stripe subscription status (e.g., 'trialing' -> REGISTERED, 'active' -> ENROLLED)
      // Only update email if we have a validated one and student doesn't have one
      ...(matchResult.validatedEmail &&
        !matchResult.student.email && { email: matchResult.validatedEmail }),
    }

    // Track subscription history: if student already has a subscription, add it to history
    if (oldSubscriptionId && oldSubscriptionId !== subscriptionId) {
      updateData.previousSubscriptionIds = {
        push: oldSubscriptionId,
      }
    }

    // Link the student to the subscription
    await prisma.student.update({
      where: { id: matchResult.student.id },
      data: updateData,
    })

    console.log(
      `[WEBHOOK] Successfully linked Subscription ID: ${subscriptionId} to Student: ${matchResult.student.name} (${matchResult.student.id}) via ${matchResult.matchMethod}`
    )
    if (oldSubscriptionId) {
      console.log(
        `[WEBHOOK] Added previous subscription ${oldSubscriptionId} to history`
      )
    }

    // Sync the initial state. The subscription is now linked, and its status
    // will be updated to reflect the true state from Stripe (e.g., 'trialing' -> REGISTERED, 'active' -> ENROLLED).
    await syncStudentSubscriptionState(subscriptionId)
  } else {
    // Log detailed warning for manual review
    studentMatcher.logNoMatchFound(session, subscriptionId)
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

  const students = await prisma.student.findMany({
    where: {
      stripeSubscriptionId: subscription.id,
      program: 'MAHAD_PROGRAM', // ✅ Prevent cross-contamination with Dugsi
    },
  })

  if (students.length === 0) {
    console.log(
      `[WEBHOOK] Invoice ${invoice.id} succeeded, but no students found for subscription ${subscription.id}.`
    )
    return
  }

  const periodStart = new Date(subscriptionLineItem.period.start * 1000)
  const paidAt = invoice.status_transitions.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date()

  const amountPerStudent =
    students.length > 0 ? Math.floor(invoice.amount_paid / students.length) : 0

  const paymentData = students.map((student) => ({
    studentId: student.id,
    stripeInvoiceId: stripeInvoiceId,
    amountPaid: amountPerStudent,
    year: periodStart.getUTCFullYear(),
    month: periodStart.getUTCMonth() + 1,
    paidAt: paidAt,
  }))

  const { count: createdCount } = await prisma.studentPayment.createMany({
    data: paymentData,
    skipDuplicates: true,
  })

  if (createdCount > 0) {
    console.log(
      `[WEBHOOK] Successfully created ${createdCount} payment record(s) for Invoice ID: ${stripeInvoiceId}.`
    )
  }
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

  // Use transaction to atomically update all students
  await prisma.$transaction(async (tx) => {
    // First, find the students associated with the subscription before it's gone.
    const students = await tx.student.findMany({
      where: {
        stripeSubscriptionId: subscription.id,
        program: 'MAHAD_PROGRAM', // ✅ Prevent cross-contamination with Dugsi
      },
      select: {
        id: true,
      },
    })

    if (students.length > 0) {
      // Build cancellation data using centralized utility
      const cancellationData = buildCancellationUpdateData(
        subscription.id,
        'MAHAD'
      )

      // Update each student with cancellation data
      await Promise.all(
        students.map((student) =>
          tx.student.update({
            where: { id: student.id },
            data: cancellationData,
          })
        )
      )

      console.log(
        `[WEBHOOK] Subscription ${subscription.id} deleted. Added to history, unlinked and marked ${students.length} student(s) as canceled/withdrawn.`
      )
    }
  })
}
