import { Prisma } from '@prisma/client'
import type Stripe from 'stripe'

import { prisma } from '@/lib/db'
import { createServiceLogger, logError } from '@/lib/logger'

const logger = createServiceLogger('donation-webhook')

type InvoiceWithRelations = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription
  payment_intent?: string | Stripe.PaymentIntent | null
}

function toJsonOrUndefined(
  value: Record<string, string> | null | undefined
): Prisma.InputJsonValue | undefined {
  if (!value) return undefined
  return value as Prisma.InputJsonValue
}

export async function handleOneTimeDonation(
  session: Stripe.Checkout.Session
): Promise<void> {
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id

  if (!paymentIntentId) {
    logger.error({ sessionId: session.id }, 'No payment intent on session')
    throw new Error('Missing payment_intent on checkout session')
  }

  const isAnonymous = session.metadata?.isAnonymous === 'true'

  await prisma.donation.upsert({
    where: { stripePaymentIntentId: paymentIntentId },
    create: {
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId:
        typeof session.customer === 'string'
          ? session.customer
          : (session.customer?.id ?? null),
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: 'succeeded',
      donorName: isAnonymous
        ? null
        : (session.customer_details?.name ??
          session.metadata?.donorName ??
          null),
      donorEmail: session.customer_details?.email ?? null,
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
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id

  if (!subscriptionId) {
    logger.error({ sessionId: session.id }, 'No subscription on session')
    throw new Error('Missing subscription on checkout session')
  }

  const isAnonymous = session.metadata?.isAnonymous === 'true'

  const placeholderPiId = `sub_setup_${subscriptionId}`

  await prisma.donation.upsert({
    where: { stripePaymentIntentId: placeholderPiId },
    create: {
      stripePaymentIntentId: placeholderPiId,
      stripeCustomerId:
        typeof session.customer === 'string'
          ? session.customer
          : (session.customer?.id ?? null),
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: 'pending',
      donorName: isAnonymous
        ? null
        : (session.customer_details?.name ??
          session.metadata?.donorName ??
          null),
      donorEmail: session.customer_details?.email ?? null,
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

  logger.info(
    { subscriptionId, amount: session.amount_total },
    'Recurring donation checkout recorded'
  )
}

export async function handleDonationPaymentIntentSucceeded(
  event: Stripe.Event
): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent

  try {
    const existing = await prisma.donation.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    })

    if (existing) {
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
    } else {
      logger.info(
        { paymentIntentId: paymentIntent.id },
        'Payment intent not found in donations - may be handled by checkout.session.completed'
      )
    }
  } catch (err) {
    await logError(
      logger,
      err,
      'Failed to handle donation payment_intent.succeeded',
      {
        paymentIntentId: paymentIntent.id,
      }
    )
    throw err
  }
}

export async function handleDonationInvoicePaid(
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as InvoiceWithRelations

  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : (invoice.subscription?.id ?? null)

  if (!subscriptionId || !invoice.payment_intent) return

  const paymentIntentId =
    typeof invoice.payment_intent === 'string'
      ? invoice.payment_intent
      : invoice.payment_intent.id

  await prisma.donation.upsert({
    where: { stripePaymentIntentId: paymentIntentId },
    create: {
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId:
        typeof invoice.customer === 'string'
          ? invoice.customer
          : (invoice.customer?.id ?? null),
      amount: invoice.amount_paid,
      currency: invoice.currency ?? 'usd',
      status: 'succeeded',
      donorEmail: invoice.customer_email ?? null,
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

  logger.info(
    { invoiceId: invoice.id, subscriptionId, amount: invoice.amount_paid },
    'Recurring donation invoice paid'
  )
}
