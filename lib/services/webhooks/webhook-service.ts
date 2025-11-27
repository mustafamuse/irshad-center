/**
 * Webhook Service
 *
 * Cross-program Stripe webhook event processing.
 * Handles subscription lifecycle events from both Mahad and Dugsi.
 *
 * Responsibilities:
 * - Process payment method capture events
 * - Handle subscription creation/update/deletion events
 * - Process invoice events
 * - Manage billing assignments
 *
 * Uses shared services for DRY implementation.
 */

import { StripeAccountType, SubscriptionStatus } from '@prisma/client'
import type {
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'

import { prisma } from '@/lib/db'
import {
  getBillingAccountByStripeCustomerId,
  getSubscriptionByStripeId,
  getBillingAssignmentsBySubscription,
} from '@/lib/db/queries/billing'
import { getProgramProfilesByFamilyId } from '@/lib/db/queries/program-profile'
import { createServiceLogger } from '@/lib/logger'
import {
  createOrUpdateBillingAccount,
  linkSubscriptionToProfiles,
  unlinkSubscription,
} from '@/lib/services/shared/billing-service'
import {
  createSubscriptionFromStripe,
  updateSubscriptionStatus,
} from '@/lib/services/shared/subscription-service'
import { calculateMahadRate } from '@/lib/utils/mahad-tuition'
import {
  extractCustomerId,
  extractPeriodDates,
  isValidSubscriptionStatus,
} from '@/lib/utils/type-guards'

const logger = createServiceLogger('webhook')

/**
 * Payment method capture result
 */
export interface PaymentMethodCaptureResult {
  billingAccountId: string
  customerId: string
  paymentMethodCaptured: boolean
}

/**
 * Subscription event result
 */
export interface SubscriptionEventResult {
  subscriptionId: string
  status: SubscriptionStatus
  created: boolean
}

/**
 * Handle payment method capture from checkout session.
 *
 * Called when checkout.session.completed event is received.
 * Captures payment method and links to billing account.
 *
 * @param session - Stripe checkout session
 * @param accountType - Stripe account type
 * @param personId - Person ID to link billing account to
 * @returns Capture result
 */
export async function handlePaymentMethodCapture(
  session: Stripe.Checkout.Session,
  accountType: StripeAccountType,
  personId: string
): Promise<PaymentMethodCaptureResult> {
  const { customer, payment_intent } = session

  // Validate customer ID
  const customerId =
    typeof customer === 'string' ? customer : (customer?.id ?? null)

  if (!customerId) {
    throw new Error('Invalid or missing customer ID in checkout session')
  }

  // Extract payment intent ID
  const paymentIntentId =
    typeof payment_intent === 'string'
      ? payment_intent
      : (payment_intent?.id ?? undefined)

  // Create or update billing account with payment method captured
  const billingAccount = await Sentry.startSpan(
    {
      name: 'billing.create_or_update_account',
      op: 'db.transaction',
      attributes: {
        account_type: accountType,
        customer_id: customerId,
        person_id: personId,
      },
    },
    async () =>
      await createOrUpdateBillingAccount({
        personId,
        accountType,
        stripeCustomerId: customerId,
        paymentMethodCaptured: true,
        paymentMethodCapturedAt: new Date(),
        paymentIntentId,
      })
  )

  return {
    billingAccountId: billingAccount.id,
    customerId,
    paymentMethodCaptured: true,
  }
}

/**
 * Handle subscription creation event.
 *
 * Called when customer.subscription.created event is received.
 * Creates subscription in database and links to profiles.
 *
 * @param subscription - Stripe subscription object
 * @param accountType - Stripe account type
 * @param profileIds - Program profile IDs to link (optional)
 * @returns Subscription event result
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  accountType: StripeAccountType,
  profileIds?: string[]
): Promise<SubscriptionEventResult> {
  const customerId = extractCustomerId(subscription.customer)

  if (!customerId) {
    throw new Error('Invalid customer ID in subscription')
  }

  // Get or create billing account
  let billingAccount = await getBillingAccountByStripeCustomerId(
    customerId,
    accountType
  )

  if (!billingAccount) {
    // Find person by customer ID in contactPoints or create placeholder
    const person = await prisma.person.findFirst({
      where: {
        billingAccounts: {
          some: {
            OR: [
              { stripeCustomerIdMahad: customerId },
              { stripeCustomerIdDugsi: customerId },
            ],
          },
        },
      },
    })

    if (!person) {
      throw new Error(
        `No person found for customer ${customerId}. Payment method must be captured first.`
      )
    }

    billingAccount = await createOrUpdateBillingAccount({
      personId: person.id,
      accountType,
      stripeCustomerId: customerId,
    })
  }

  // Create subscription in database
  const dbSubscription = await Sentry.startSpan(
    {
      name: 'subscription.create_from_stripe',
      op: 'db.transaction',
      attributes: {
        account_type: accountType,
        stripe_subscription_id: subscription.id,
        billing_account_id: billingAccount.id,
      },
    },
    async () =>
      await createSubscriptionFromStripe(
        subscription,
        billingAccount.id,
        accountType
      )
  )

  // Validate rate against calculated rate if metadata is present (Mahad checkout)
  const subscriptionMetadata = subscription.metadata || {}
  if (
    accountType === 'MAHAD' &&
    subscriptionMetadata.calculatedRate &&
    subscriptionMetadata.graduationStatus &&
    subscriptionMetadata.paymentFrequency &&
    subscriptionMetadata.billingType
  ) {
    const priceAmount = subscription.items?.data?.[0]?.price?.unit_amount
    const expectedRate = parseInt(subscriptionMetadata.calculatedRate, 10)

    // Validate that the checkout session calculated rate matches the actual rate
    const actualCalculatedRate = calculateMahadRate(
      subscriptionMetadata.graduationStatus as GraduationStatus,
      subscriptionMetadata.paymentFrequency as PaymentFrequency,
      subscriptionMetadata.billingType as StudentBillingType
    )

    if (priceAmount !== expectedRate) {
      logger.warn(
        {
          subscriptionId: subscription.id,
          stripeAmount: priceAmount,
          expectedRate,
          graduationStatus: subscriptionMetadata.graduationStatus,
          paymentFrequency: subscriptionMetadata.paymentFrequency,
          billingType: subscriptionMetadata.billingType,
        },
        'Rate mismatch: Stripe amount differs from expected calculated rate'
      )
    }

    if (actualCalculatedRate !== expectedRate) {
      logger.warn(
        {
          subscriptionId: subscription.id,
          metadataRate: expectedRate,
          recalculatedRate: actualCalculatedRate,
          graduationStatus: subscriptionMetadata.graduationStatus,
          paymentFrequency: subscriptionMetadata.paymentFrequency,
          billingType: subscriptionMetadata.billingType,
        },
        'Rate calculation mismatch: Stored metadata rate differs from recalculated rate'
      )
    }

    logger.info(
      {
        subscriptionId: subscription.id,
        profileId: subscriptionMetadata.profileId,
        studentName: subscriptionMetadata.studentName,
        stripeAmount: priceAmount,
        expectedRate,
        graduationStatus: subscriptionMetadata.graduationStatus,
        paymentFrequency: subscriptionMetadata.paymentFrequency,
        billingType: subscriptionMetadata.billingType,
        rateValid: priceAmount === expectedRate,
      },
      'Mahad subscription rate validation completed'
    )
  }

  // Link to profiles if provided
  if (profileIds && profileIds.length > 0) {
    // Validate subscription has items with valid pricing
    if (!subscription.items?.data?.length) {
      logger.error(
        { subscriptionId: subscription.id },
        'Subscription has no items - cannot link to profiles'
      )
      throw new Error('Subscription has no items')
    }

    const priceAmount = subscription.items.data[0]?.price?.unit_amount
    if (priceAmount === null || priceAmount === undefined || priceAmount <= 0) {
      logger.error(
        { subscriptionId: subscription.id, priceAmount },
        'Subscription has invalid amount - cannot link to profiles'
      )
      throw new Error('Subscription has invalid amount')
    }

    const amount = priceAmount
    await Sentry.startSpan(
      {
        name: 'subscription.link_profiles',
        op: 'db.transaction',
        attributes: {
          subscription_id: dbSubscription.id,
          num_profiles: profileIds.length,
          amount,
        },
      },
      async () =>
        await linkSubscriptionToProfiles(
          dbSubscription.id,
          profileIds,
          amount,
          'Linked automatically via webhook'
        )
    )
  }

  return {
    subscriptionId: dbSubscription.id,
    status: dbSubscription.status,
    created: true,
  }
}

/**
 * Handle subscription update event.
 *
 * Called when customer.subscription.updated event is received.
 * Updates subscription status and period dates.
 *
 * @param subscription - Stripe subscription object
 * @returns Subscription event result
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<SubscriptionEventResult> {
  const stripeSubscriptionId = subscription.id

  // Get subscription from database
  const dbSubscription = await getSubscriptionByStripeId(stripeSubscriptionId)

  if (!dbSubscription) {
    throw new Error(
      `Subscription ${stripeSubscriptionId} not found in database. It may need to be created first.`
    )
  }

  // Validate status
  const status = subscription.status as SubscriptionStatus
  if (!isValidSubscriptionStatus(status)) {
    throw new Error(`Invalid subscription status: ${status}`)
  }

  // Extract period dates
  const periodDates = extractPeriodDates(subscription)

  // Update subscription
  await updateSubscriptionStatus(stripeSubscriptionId, status, {
    currentPeriodStart: periodDates.periodStart,
    currentPeriodEnd: periodDates.periodEnd,
    paidUntil: periodDates.periodEnd,
  })

  return {
    subscriptionId: dbSubscription.id,
    status,
    created: false,
  }
}

/**
 * Handle subscription deletion event.
 *
 * Called when customer.subscription.deleted event is received.
 * Marks subscription as canceled and deactivates billing assignments.
 *
 * @param subscription - Stripe subscription object
 * @returns Subscription event result
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<SubscriptionEventResult> {
  const stripeSubscriptionId = subscription.id

  // Get subscription from database
  const dbSubscription = await getSubscriptionByStripeId(stripeSubscriptionId)

  if (!dbSubscription) {
    logger.warn(
      { stripeSubscriptionId },
      'Subscription not found in database - may already be deleted'
    )
    return {
      subscriptionId: '',
      status: 'canceled',
      created: false,
    }
  }

  // Update subscription to canceled
  await updateSubscriptionStatus(stripeSubscriptionId, 'canceled')

  // Unlink subscription from all profiles
  await unlinkSubscription(dbSubscription.id)

  return {
    subscriptionId: dbSubscription.id,
    status: 'canceled',
    created: false,
  }
}

/**
 * Handle invoice finalized event.
 *
 * Called when invoice.finalized event is received.
 * Updates subscription paid_until date.
 *
 * @param invoice - Stripe invoice object
 * @returns Updated subscription or null
 */
export async function handleInvoiceFinalized(
  invoice: Stripe.Invoice
): Promise<{ subscriptionId: string; paidUntil: Date | null } | null> {
  // Extract subscription ID (may be expanded object or just the ID string)
  // Type assertion needed because Stripe's Invoice type doesn't include expanded subscription
  const invoiceData = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription
  }
  const subscriptionId =
    typeof invoiceData.subscription === 'string'
      ? invoiceData.subscription
      : (invoiceData.subscription?.id ?? null)

  if (!subscriptionId) {
    // Not a subscription invoice
    return null
  }

  // Get subscription from database
  const dbSubscription = await getSubscriptionByStripeId(subscriptionId)

  if (!dbSubscription) {
    logger.warn(
      { subscriptionId, invoiceId: invoice.id },
      'Subscription not found for invoice'
    )
    return null
  }

  // Update paid_until to the period_end of the invoice
  const paidUntil = invoice.period_end
    ? new Date(invoice.period_end * 1000)
    : null

  await updateSubscriptionStatus(subscriptionId, dbSubscription.status, {
    paidUntil,
  })

  return {
    subscriptionId: dbSubscription.id,
    paidUntil,
  }
}

/**
 * Get billing assignments for a subscription.
 *
 * Helper to get all active billing assignments for a subscription.
 * Used by webhook handlers to determine which profiles are affected.
 *
 * @param stripeSubscriptionId - Stripe subscription ID
 * @returns Array of billing assignments
 */
export async function getSubscriptionAssignments(stripeSubscriptionId: string) {
  const subscription = await getSubscriptionByStripeId(stripeSubscriptionId)

  if (!subscription) {
    return []
  }

  return await getBillingAssignmentsBySubscription(subscription.id)
}

/**
 * Link subscription to family profiles.
 *
 * Helper for Dugsi webhooks to link a subscription to all family members.
 *
 * @param stripeSubscriptionId - Stripe subscription ID
 * @param familyId - Family reference ID
 * @param amount - Subscription amount
 * @returns Number of profiles linked
 */
export async function linkSubscriptionToFamily(
  stripeSubscriptionId: string,
  familyId: string,
  amount: number
): Promise<number> {
  // Get subscription from database
  const subscription = await getSubscriptionByStripeId(stripeSubscriptionId)

  if (!subscription) {
    throw new Error('Subscription not found in database')
  }

  // Get all family profiles
  const profiles = await getProgramProfilesByFamilyId(familyId)
  const profileIds = profiles.map((p) => p.id)

  // Link subscription to all family members
  return await linkSubscriptionToProfiles(
    subscription.id,
    profileIds,
    amount,
    'Linked automatically via webhook'
  )
}
