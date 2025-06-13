import type { Student } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { Stripe } from 'stripe'

import { prisma } from '@/lib/db'
import { stripeServerClient as stripe } from '@/lib/stripe'

/**
 * The single source of truth for syncing a subscription from Stripe to our database.
 * This function fetches the latest subscription data from Stripe and updates the
 * corresponding student records.
 * @param subscriptionId - The ID of the Stripe subscription to sync.
 */
async function syncStudentSubscriptionState(subscriptionId: string) {
  console.log(
    `[WEBHOOK] syncStudentSubscriptionState: Starting sync for Subscription ID: ${subscriptionId}`
  )
  try {
    const subscription: Stripe.Subscription =
      await stripe.subscriptions.retrieve(subscriptionId)

    // Find all students linked to this subscription
    const students = await prisma.student.findMany({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (students.length === 0) {
      console.log(
        `[WEBHOOK] syncStudentSubscriptionState: No students found for Subscription ID: ${subscription.id}. Skipping sync.`
      )
      return
    }

    const { count } = await prisma.student.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        subscriptionStatus: subscription.status,
        paidUntil: new Date((subscription as any).current_period_end * 1000),
      },
    })

    console.log(
      `[WEBHOOK] syncStudentSubscriptionState: Successfully synced Subscription ID: ${subscription.id}. Matched and updated ${count} student(s) to status: ${subscription.status}.`
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

  let studentToUpdate: Student | null = null

  // 1. Find by name from the custom field.
  const studentNameField = session.custom_fields?.find(
    (f) => f.key === 'studentsemailonethatyouusedtoregister'
  )
  const studentName = studentNameField?.text?.value

  if (studentName) {
    const students = await prisma.student.findMany({
      where: {
        name: { equals: studentName, mode: 'insensitive' },
        stripeSubscriptionId: null,
      },
    })
    if (students.length === 1) {
      studentToUpdate = students[0]
      console.log(
        `[WEBHOOK] Found unique student by name: ${studentName}. Student ID: ${studentToUpdate.id}`
      )
    }
  }

  // 2. If not found, find by phone number from the custom field.
  if (!studentToUpdate) {
    const studentPhoneField = session.custom_fields?.find(
      (f) => f.key === 'studentswhatsappthatyouuseforourgroup'
    )
    const studentPhoneFromStripe = studentPhoneField?.numeric?.value

    if (studentPhoneFromStripe) {
      const normalizedPhone = studentPhoneFromStripe.replace(/\D/g, '')
      const students = await prisma.$queryRaw<Student[]>(Prisma.sql`
        SELECT * FROM "Student"
        WHERE REGEXP_REPLACE("phone", '[^0-9]', '', 'g') = ${normalizedPhone}
        AND "stripeSubscriptionId" IS NULL
      `)

      if (students.length === 1) {
        studentToUpdate = students[0]
        console.log(
          `[WEBHOOK] Found unique student by normalized phone: ${normalizedPhone}. Student ID: ${studentToUpdate.id}`
        )
      }
    }
  }

  // 3. If still not found, fall back to the payer's email.
  const payerEmail = session.customer_details?.email
  if (!studentToUpdate && payerEmail) {
    const students = await prisma.student.findMany({
      where: {
        email: { equals: payerEmail, mode: 'insensitive' },
        stripeSubscriptionId: null,
      },
    })
    if (students.length === 1) {
      studentToUpdate = students[0]
      console.log(
        `[WEBHOOK] Found unique student by payer email: ${payerEmail}. Student ID: ${studentToUpdate.id}`
      )
    }
  }

  // If a unique student was found by either strategy, link them.
  if (studentToUpdate) {
    await prisma.student.update({
      where: { id: studentToUpdate.id },
      data: {
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscriptionId,
        status: 'enrolled',
        email: payerEmail,
      },
    })
    console.log(
      `[WEBHOOK] Successfully linked Subscription ID: ${subscriptionId} to Student: ${studentToUpdate.name} (${studentToUpdate.id})`
    )

    // Sync the initial state. The subscription is now linked, and its status
    // will be updated to reflect the true state from Stripe (e.g., 'trialing' or 'active').
    await syncStudentSubscriptionState(subscriptionId)
  } else {
    // If no unique student was found, log a detailed warning for manual review.
    const studentPhone = session.custom_fields?.find(
      (f) => f.key === 'studentswhatsappthatyouuseforourgroup'
    )?.numeric?.value
    console.warn(
      `[WEBHOOK] Could not find a unique, unlinked student for subscription ${subscriptionId}. ` +
        `Attempted lookup with name: "${studentName || 'N/A'}", ` +
        `phone: "${studentPhone || 'N/A'}", ` +
        `and payer email: "${payerEmail || 'N/A'}". Manual review required.`
    )
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
    where: { stripeSubscriptionId: subscription.id },
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

  // First, find the students associated with the subscription before it's gone.
  const students = await prisma.student.findMany({
    where: { stripeSubscriptionId: subscription.id },
  })

  if (students.length > 0) {
    const { count } = await prisma.student.updateMany({
      where: {
        id: { in: students.map((s) => s.id) },
      },
      data: {
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: null, // Unlink the subscription
        paidUntil: null, // Clear the paid until date
      },
    })
    console.log(
      `[WEBHOOK] Subscription ${subscription.id} deleted. Unlinked and marked ${count} student(s) as canceled.`
    )
  }
}
