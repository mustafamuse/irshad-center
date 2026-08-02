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

import { revalidateTag } from 'next/cache'

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
  updateSubscriptionStatus as updateSubscriptionStatusQuery,
} from '@/lib/db/queries/billing'
import {
  findPersonByBillingCustomerId,
  getPersonById,
} from '@/lib/db/queries/person'
import type { DatabaseClient } from '@/lib/db/types'
import { createServiceLogger, logError } from '@/lib/logger'
import {
  createOrUpdateBillingAccount,
  linkSubscriptionToProfiles,
  unlinkSubscription,
} from '@/lib/services/shared/billing-service'
import { handleSubscriptionCancellationEnrollments } from '@/lib/services/shared/enrollment-service'
import { createSubscriptionFromStripe } from '@/lib/services/shared/subscription-service'
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'
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
 * Resolve the billing account a new subscription should attach to.
 *
 * Order: existing account by Stripe customer ID; then metadata
 * personId/guardianPersonId, DB-verified first (metadata is a hint, not
 * authority - a stale or mistyped ID entered in the Stripe dashboard must not
 * attribute billing to a person that does not exist); then person lookup by
 * the program's own billing customer-ID column. Returns null when no person
 * resolves - the caller fails soft and escalates for manual linking.
 */
async function resolveBillingAccountForSubscription(
  subscription: Stripe.Subscription,
  customerId: string,
  accountType: StripeAccountType
) {
  const billingAccount = await getBillingAccountByStripeCustomerId(
    customerId,
    accountType
  )
  if (billingAccount) return billingAccount

  const metadataPersonId =
    subscription.metadata?.personId || subscription.metadata?.guardianPersonId

  let resolvedPersonId: string | null = null
  let fromVerifiedMetadata = false

  if (metadataPersonId) {
    const metadataPerson = await getPersonById(metadataPersonId)
    if (metadataPerson) {
      resolvedPersonId = metadataPerson.id
      fromVerifiedMetadata = true
      logger.info(
        {
          customerId,
          personId: metadataPersonId,
          subscriptionId: subscription.id,
        },
        'Creating billing account from subscription metadata'
      )
    } else {
      logger.warn(
        {
          customerId,
          personId: metadataPersonId,
          subscriptionId: subscription.id,
        },
        'Subscription metadata person ID not found in database - falling back'
      )
      Sentry.captureMessage('Subscription metadata references unknown person', {
        level: 'warning',
        extra: {
          subscriptionId: subscription.id,
          customerId,
          accountType,
          metadataPersonId,
        },
      })
    }
  }

  if (!resolvedPersonId) {
    const person = await findPersonByBillingCustomerId(customerId, accountType)
    if (person) {
      resolvedPersonId = person.id
    }
  }

  if (!resolvedPersonId) return null

  return createOrUpdateBillingAccount({
    personId: resolvedPersonId,
    accountType,
    stripeCustomerId: customerId,
    ...(fromVerifiedMetadata
      ? {
          paymentMethodCaptured: true,
          paymentMethodCapturedAt: new Date(),
        }
      : {}),
  })
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

  // Idempotency beyond the WebhookEvent table: the same subscription can
  // arrive via different event deliveries or race checkout.session.completed.
  // Skip creation only - fall through to profile linking, which is itself
  // idempotent, so a retry after a partial failure (row created, linking
  // threw) still completes the linking instead of silently returning.
  const existingSubscription = await getSubscriptionByStripeId(subscription.id)
  if (existingSubscription) {
    logger.info(
      { subscriptionId: subscription.id, accountType },
      'Subscription already exists - skipping creation, ensuring linking'
    )
  }

  let dbSubscription: { id: string; status: SubscriptionStatus } | null =
    existingSubscription
  let created = false

  if (!dbSubscription) {
    const billingAccount = await resolveBillingAccountForSubscription(
      subscription,
      customerId,
      accountType
    )

    if (!billingAccount) {
      // Permanent failure: retrying cannot resolve a person that is not in
      // the database. Fail soft (2xx) instead of throwing so Stripe does not
      // retry for 72 hours, and escalate for manual linking via the admin
      // link-subscriptions page - mirroring the checkout no-match path.
      Sentry.captureMessage('Subscription could not be matched to person', {
        level: 'error',
        extra: {
          subscriptionId: subscription.id,
          customerId,
          accountType,
          metadataSource: subscription.metadata?.source ?? null,
          action: 'manual_linking_required',
        },
      })
      logger.warn(
        { subscriptionId: subscription.id, customerId, accountType },
        'No person found for subscription - manual linking required'
      )
      return {
        subscriptionId: subscription.id,
        status: subscription.status as SubscriptionStatus,
        created: false,
      }
    }

    // Create subscription in database
    dbSubscription = await Sentry.startSpan(
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
    created = true
  }

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

    // Overrides are validated against finalRate (the override-inclusive amount)
    // so tampering is still detected; legacy override subs without finalRate
    // metadata cannot be validated and are skipped.
    const isOverride = subscriptionMetadata.isOverride === 'true'
    const parsedFinalRate = parseInt(subscriptionMetadata.finalRate ?? '', 10)
    const overrideRate = Number.isFinite(parsedFinalRate)
      ? parsedFinalRate
      : null
    const rateToMatch = isOverride ? overrideRate : expectedRate

    if (rateToMatch !== null && priceAmount !== rateToMatch) {
      logger.warn(
        {
          subscriptionId: subscription.id,
          stripeAmount: priceAmount,
          expectedRate: rateToMatch,
          isOverride,
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

  // Validate rate for Dugsi subscriptions
  if (
    accountType === 'DUGSI' &&
    subscriptionMetadata.calculatedRate &&
    subscriptionMetadata.childCount
  ) {
    const priceAmount = subscription.items?.data?.[0]?.price?.unit_amount
    const expectedRate = parseInt(subscriptionMetadata.calculatedRate, 10)
    const childCount = parseInt(subscriptionMetadata.childCount, 10)

    const actualCalculatedRate = calculateDugsiRate(childCount)

    if (priceAmount !== expectedRate) {
      logger.warn(
        {
          subscriptionId: subscription.id,
          stripeAmount: priceAmount,
          expectedRate,
          childCount,
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
          childCount,
        },
        'Rate calculation mismatch: Stored metadata rate differs from recalculated rate'
      )
    }

    logger.info(
      {
        subscriptionId: subscription.id,
        stripeAmount: priceAmount,
        expectedRate,
        childCount,
        rateValid: priceAmount === expectedRate,
      },
      'Dugsi subscription rate validation completed'
    )
  }

  // Link to profiles if provided
  if (profileIds && profileIds.length > 0) {
    // Validate subscription has items with valid pricing
    if (!subscription.items?.data?.length) {
      const error = new Error('Subscription has no items')
      await logError(
        logger,
        error,
        'Subscription has no items - cannot link to profiles',
        {
          subscriptionId: subscription.id,
        }
      )
      throw error
    }

    const priceAmount = subscription.items.data[0]?.price?.unit_amount
    if (priceAmount === null || priceAmount === undefined || priceAmount <= 0) {
      const error = new Error('Subscription has invalid amount')
      await logError(
        logger,
        error,
        'Subscription has invalid amount - cannot link to profiles',
        {
          subscriptionId: subscription.id,
          priceAmount,
        }
      )
      throw error
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

  if (accountType === 'MAHAD') {
    revalidateTag('mahad-students')
  } else if (accountType === 'DUGSI') {
    revalidateTag('dugsi-registrations')
  }

  return {
    subscriptionId: dbSubscription.id,
    status: dbSubscription.status,
    created,
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
  subscription: Stripe.Subscription,
  accountType: StripeAccountType
): Promise<SubscriptionEventResult> {
  const stripeSubscriptionId = subscription.id

  // Get subscription from database
  const dbSubscription = await getSubscriptionByStripeId(stripeSubscriptionId)

  if (!dbSubscription) {
    logger.warn(
      { stripeSubscriptionId },
      'Subscription not found in database - student may need to re-register'
    )
    return {
      subscriptionId: '',
      status: subscription.status as SubscriptionStatus,
      created: false,
    }
  }

  // Validate status
  const status = subscription.status as SubscriptionStatus
  if (!isValidSubscriptionStatus(status)) {
    throw new Error(`Invalid subscription status: ${status}`)
  }

  // Extract period dates
  const periodDates = extractPeriodDates(subscription)

  // Update subscription
  await updateSubscriptionStatusQuery(dbSubscription.id, status, {
    currentPeriodStart: periodDates.periodStart,
    currentPeriodEnd: periodDates.periodEnd,
    paidUntil: periodDates.periodEnd,
  })

  if (accountType === 'MAHAD') {
    revalidateTag('mahad-students')
  } else if (accountType === 'DUGSI') {
    revalidateTag('dugsi-registrations')
  }

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
  subscription: Stripe.Subscription,
  accountType: StripeAccountType
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

  // Update subscription to canceled, cascade enrollment/profile WITHDRAWN,
  // and unlink assignments. Order matters: the cascade reads still-active
  // assignments, so it MUST run before unlinkSubscription deactivates them.
  await prisma.$transaction(async (tx) => {
    await updateSubscriptionStatusQuery(
      dbSubscription.id,
      'canceled',
      undefined,
      tx
    )
    await handleSubscriptionCancellationEnrollments(
      stripeSubscriptionId,
      'Stripe subscription canceled',
      tx
    )
    await unlinkSubscription(dbSubscription.id, tx)
  })

  if (accountType === 'MAHAD') {
    revalidateTag('mahad-students')
  } else if (accountType === 'DUGSI') {
    revalidateTag('dugsi-registrations')
  }

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
  invoice: Stripe.Invoice,
  accountType: StripeAccountType
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

  await updateSubscriptionStatusQuery(
    dbSubscription.id,
    dbSubscription.status,
    {
      paidUntil,
    }
  )

  if (accountType === 'MAHAD') {
    revalidateTag('mahad-students')
  } else if (accountType === 'DUGSI') {
    revalidateTag('dugsi-registrations')
  }

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
export async function getSubscriptionAssignments(
  stripeSubscriptionId: string,
  client: DatabaseClient = prisma
) {
  const subscription = await getSubscriptionByStripeId(
    stripeSubscriptionId,
    client
  )

  if (!subscription) {
    return []
  }

  return await getBillingAssignmentsBySubscription(subscription.id, client)
}
