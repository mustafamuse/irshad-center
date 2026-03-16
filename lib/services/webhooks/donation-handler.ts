// Donation webhook handlers use synthetic stripePaymentIntentId values for records
// that don't correspond to real Stripe PaymentIntents:
//   sub_setup_{subscriptionId}    -- placeholder created at recurring checkout, cleaned up on first invoice
//   sub_cancelled_{subscriptionId} -- cancellation marker to exclude subscription from MRR

import { Prisma } from '@prisma/client'
import type Stripe from 'stripe'

import { prisma } from '@/lib/db'
import { createServiceLogger, logError } from '@/lib/logger'
import { extractCustomerId } from '@/lib/utils/type-guards'

const logger = createServiceLogger('donation-webhook')

type InvoiceWithRelations = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription
  payment_intent?: string | Stripe.PaymentIntent | null
}

const SETUP_PREFIX = 'sub_setup_'
const CANCELLED_PREFIX = 'sub_cancelled_'

function toJsonOrUndefined(
  value: Record<string, string> | null | undefined
): Prisma.InputJsonValue | undefined {
  if (!value) return undefined
  return value as Prisma.InputJsonValue
}

function resolveStripeId(
  field: string | { id: string } | null | undefined
): string | null {
  if (!field) return null
  if (typeof field === 'string') return field
  return field.id ?? null
}

function resolveDonorName(
  session: Stripe.Checkout.Session,
  isAnonymous: boolean
): string | null {
  if (isAnonymous) return null
  return session.customer_details?.name ?? session.metadata?.donorName ?? null
}

export async function handleOneTimeDonation(
  session: Stripe.Checkout.Session
): Promise<void> {
  const paymentIntentId = resolveStripeId(session.payment_intent)

  if (!paymentIntentId) {
    logger.error({ sessionId: session.id }, 'No payment intent on session')
    throw new Error('Missing payment_intent on checkout session')
  }

  if (!session.amount_total) {
    logger.warn(
      { sessionId: session.id, paymentIntentId },
      'One-time donation checkout has null/zero amount_total'
    )
  }

  const isAnonymous = session.metadata?.isAnonymous === 'true'

  await prisma.donation.upsert({
    where: { stripePaymentIntentId: paymentIntentId },
    create: {
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId: extractCustomerId(session.customer),
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: 'succeeded',
      donorName: resolveDonorName(session, isAnonymous),
      donorEmail: session.customer_details?.email ?? null,
      donorPhone: session.customer_details?.phone ?? null,
      isAnonymous,
      isRecurring: false,
      metadata: toJsonOrUndefined(
        session.metadata as Record<string, string> | null
      ),
      paidAt: new Date(),
    },
    update: {
      status: 'succeeded',
      paidAt: new Date(),
    },
  })

  logger.info(
    { paymentIntentId, amount: session.amount_total },
    'One-time donation recorded'
  )
}

export async function handleRecurringDonationCheckout(
  session: Stripe.Checkout.Session
): Promise<void> {
  const subscriptionId = resolveStripeId(session.subscription)

  if (!subscriptionId) {
    logger.error({ sessionId: session.id }, 'No subscription on session')
    throw new Error('Missing subscription on checkout session')
  }

  if (!session.amount_total) {
    logger.warn(
      { sessionId: session.id, subscriptionId },
      'Recurring donation checkout has null/zero amount_total'
    )
  }

  const isAnonymous = session.metadata?.isAnonymous === 'true'
  const placeholderPiId = `${SETUP_PREFIX}${subscriptionId}`

  const donorName = resolveDonorName(session, isAnonymous)
  const donorEmail = session.customer_details?.email ?? null
  const donorPhone = session.customer_details?.phone ?? null

  await prisma.$transaction(async (tx) => {
    const existingPayment = await tx.donation.findFirst({
      where: {
        stripeSubscriptionId: subscriptionId,
        status: 'succeeded',
        NOT: { stripePaymentIntentId: { startsWith: SETUP_PREFIX } },
      },
    })

    if (existingPayment) {
      await tx.donation.updateMany({
        where: {
          stripeSubscriptionId: subscriptionId,
          NOT: { stripePaymentIntentId: { startsWith: SETUP_PREFIX } },
        },
        data: {
          isAnonymous,
          donorName: isAnonymous ? null : donorName,
          donorEmail,
          donorPhone,
        },
      })

      logger.info(
        { subscriptionId },
        'Invoice arrived before checkout -- backfilled donor info, skipping placeholder'
      )
      return
    }

    await tx.donation.upsert({
      where: { stripePaymentIntentId: placeholderPiId },
      create: {
        stripePaymentIntentId: placeholderPiId,
        stripeCustomerId: extractCustomerId(session.customer),
        amount: session.amount_total ?? 0,
        currency: session.currency ?? 'usd',
        status: 'pending',
        donorName,
        donorEmail,
        donorPhone,
        isAnonymous,
        isRecurring: true,
        stripeSubscriptionId: subscriptionId,
        metadata: toJsonOrUndefined(
          session.metadata as Record<string, string> | null
        ),
      },
      update: {
        status: 'pending',
        stripeSubscriptionId: subscriptionId,
      },
    })
  })

  logger.info(
    { subscriptionId, amount: session.amount_total },
    'Recurring donation checkout recorded'
  )
}

export async function handleDonationPaymentIntentSucceeded(
  event: Stripe.Event
): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent

  const existing = await prisma.donation.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
  })

  if (!existing) {
    logger.info(
      { paymentIntentId: paymentIntent.id },
      'Payment intent not found in donations - may be handled by checkout.session.completed'
    )
    return
  }

  await prisma.donation.update({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: {
      status: 'succeeded',
      paidAt: new Date(),
      amount: paymentIntent.amount,
    },
  })

  logger.info(
    { paymentIntentId: paymentIntent.id },
    'Donation payment confirmed'
  )
}

export async function handleDonationInvoicePaid(
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as InvoiceWithRelations

  const subscriptionId = resolveStripeId(invoice.subscription)
  const paymentIntentId = resolveStripeId(invoice.payment_intent)

  if (!subscriptionId || !paymentIntentId) {
    logger.info(
      { invoiceId: invoice.id },
      'Invoice has no subscription or payment_intent -- skipping'
    )
    return
  }

  const checkoutDonation = await prisma.donation.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    orderBy: { createdAt: 'asc' },
    select: { isAnonymous: true, donorName: true, donorPhone: true },
  })

  const isAnonymous = checkoutDonation?.isAnonymous ?? false
  const donorName = isAnonymous
    ? null
    : (checkoutDonation?.donorName ?? invoice.customer_name ?? null)
  const donorPhone =
    checkoutDonation?.donorPhone ?? invoice.customer_phone ?? null

  await prisma.donation.upsert({
    where: { stripePaymentIntentId: paymentIntentId },
    create: {
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId: extractCustomerId(invoice.customer),
      amount: invoice.amount_paid,
      currency: invoice.currency ?? 'usd',
      status: 'succeeded',
      donorEmail: invoice.customer_email ?? null,
      donorPhone,
      isAnonymous,
      donorName,
      isRecurring: true,
      stripeSubscriptionId: subscriptionId,
      paidAt: new Date(),
    },
    update: {
      status: 'succeeded',
      paidAt: new Date(),
      amount: invoice.amount_paid,
    },
  })

  const placeholderId = `${SETUP_PREFIX}${subscriptionId}`
  if (paymentIntentId !== placeholderId) {
    await prisma.donation
      .deleteMany({
        where: { stripePaymentIntentId: placeholderId },
      })
      .catch(async (cleanupErr) => {
        await logError(
          logger,
          cleanupErr,
          'Failed to clean up donation placeholder',
          { placeholderId, subscriptionId }
        )
      })
  }

  logger.info(
    { invoiceId: invoice.id, subscriptionId, amount: invoice.amount_paid },
    'Recurring donation invoice paid'
  )
}

/**
 * Donation subscriptions cannot be stored in the Subscription table because
 * that model requires a billingAccountId linked to a Person record. Donations
 * are anonymous/standalone and have no associated billing account.
 *
 * Recurring donation tracking is done entirely via Donation records:
 * - checkout.session.completed creates the pending placeholder
 * - invoice.payment_succeeded creates the real succeeded record per charge
 */
export async function handleDonationSubscriptionCreated(
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription

  logger.info(
    {
      subscriptionId: subscription.id,
      customerId: extractCustomerId(subscription.customer),
      status: subscription.status,
    },
    'Donation subscription created -- tracking via Donation records only'
  )
}

export async function handleDonationSubscriptionUpdated(
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription

  logger.info(
    {
      subscriptionId: subscription.id,
      status: subscription.status,
    },
    'Donation subscription updated'
  )
}

export async function handleDonationInvoiceFinalized(
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice
  logger.info(
    { invoiceId: invoice.id },
    'Donation invoice finalized -- no action needed'
  )
}

export async function handleDonationSubscriptionDeleted(
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription
  const customerId = extractCustomerId(subscription.customer)
  const cancelledId = `${CANCELLED_PREFIX}${subscription.id}`

  await prisma.donation.upsert({
    where: { stripePaymentIntentId: cancelledId },
    create: {
      stripePaymentIntentId: cancelledId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      amount: 0,
      status: 'cancelled',
      isRecurring: true,
    },
    update: {
      status: 'cancelled',
    },
  })

  logger.info(
    { subscriptionId: subscription.id, customerId },
    'Donation subscription cancelled'
  )
}
