/**
 * Dugsi Consolidate Subscription Service
 *
 * Links manually-created Stripe subscriptions to families in the database.
 * This is used when admins create subscriptions directly in Stripe Dashboard
 * and need to associate them with the correct family records.
 *
 * Features:
 * - Preview subscription with mismatch detection
 * - Sync Stripe customer to match DB (optional)
 * - Handle existing links with force override
 * - Create all necessary DB records
 * - Update Stripe metadata for future webhook processing
 */

import { SubscriptionStatus } from '@prisma/client'
import Stripe from 'stripe'

import { prisma } from '@/lib/db'
import {
  getSubscriptionByStripeId,
  createSubscription,
  upsertBillingAccount,
} from '@/lib/db/queries/billing'
import { getProgramProfilesByFamilyId } from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import {
  linkSubscriptionToProfiles,
  unlinkSubscription,
} from '@/lib/services/shared/billing-service'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import {
  formatRateDisplay,
  getRateTierDescription,
} from '@/lib/utils/dugsi-tuition'
import { extractPeriodDates } from '@/lib/utils/type-guards'

const logger = createServiceLogger('consolidate-subscription-service')

interface StripeSubscriptionWithCustomer {
  subscription: Stripe.Subscription
  customer: Stripe.Customer
}

interface FamilyPayerData {
  familyProfiles: Awaited<ReturnType<typeof getProgramProfilesByFamilyId>>
  primaryPayer: {
    id: string
    name: string
    contactPoints?: Array<{ type: string; value: string }>
  }
  payerEmail: string | null
  payerPhone: string | null
}

async function fetchStripeSubscriptionWithCustomer(
  stripeSubscriptionId: string
): Promise<StripeSubscriptionWithCustomer> {
  const stripe = getDugsiStripeClient()
  const subscription = await stripe.subscriptions.retrieve(
    stripeSubscriptionId,
    { expand: ['customer'] }
  )

  if (!subscription) {
    throw new ActionError(
      'Subscription not found in Stripe',
      ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
      undefined,
      404
    )
  }

  const customer = subscription.customer
  if (typeof customer === 'string' || customer.deleted) {
    throw new ActionError(
      'Customer not found or deleted in Stripe',
      ERROR_CODES.NOT_FOUND,
      undefined,
      404
    )
  }

  return { subscription, customer }
}

async function fetchFamilyPayerData(
  familyId: string
): Promise<FamilyPayerData> {
  const familyProfiles = await getProgramProfilesByFamilyId(familyId)
  if (familyProfiles.length === 0) {
    throw new ActionError(
      'Family not found or no active children',
      ERROR_CODES.FAMILY_NOT_FOUND,
      undefined,
      404
    )
  }

  const firstChild = familyProfiles[0]
  const guardianRelationships = firstChild.person.dependentRelationships || []
  const primaryPayerRelation = guardianRelationships.find(
    (r) => r.isPrimaryPayer
  )

  if (!primaryPayerRelation?.guardian) {
    throw new ActionError(
      'No primary payer found for this family',
      ERROR_CODES.VALIDATION_ERROR,
      undefined,
      400
    )
  }

  const primaryPayer = primaryPayerRelation.guardian
  const payerEmail =
    primaryPayer.contactPoints?.find((cp) => cp.type === 'EMAIL')?.value || null
  const payerPhone =
    primaryPayer.contactPoints?.find(
      (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
    )?.value || null

  return { familyProfiles, primaryPayer, payerEmail, payerPhone }
}

function extractSubscriptionData(subscription: Stripe.Subscription) {
  const lineItem = subscription.items.data[0]
  return {
    amount: lineItem?.price?.unit_amount || 0,
    interval: lineItem?.price?.recurring?.interval || 'month',
    periodDates: extractPeriodDates(subscription),
  }
}

export interface ConsolidateSubscriptionInput {
  stripeSubscriptionId: string
  familyId: string
  syncStripeCustomer: boolean
  forceOverride?: boolean
}

export interface StripeSubscriptionPreview {
  subscriptionId: string
  customerId: string
  status: string
  amount: number
  interval: string
  periodStart: Date
  periodEnd: Date
  stripeCustomerName: string | null
  stripeCustomerEmail: string | null
  dbPayerName: string
  dbPayerEmail: string | null
  dbPayerPhone: string | null
  hasMismatch: boolean
  nameMismatch: boolean
  emailMismatch: boolean
  existingFamilyId: string | null
  existingFamilyName: string | null
  isAlreadyLinked: boolean
}

export interface ConsolidateSubscriptionResult {
  subscriptionId: string
  billingAccountId: string
  assignmentsCreated: number
  stripeMetadataUpdated: boolean
  stripeCustomerSynced: boolean
  previousFamilyUnlinked: boolean
}

/**
 * Preview a Stripe subscription for consolidation with a family.
 *
 * Fetches subscription from Stripe and compares customer details
 * with the family's primary payer in the database.
 */
export async function previewStripeSubscription(
  stripeSubscriptionId: string,
  familyId: string
): Promise<StripeSubscriptionPreview> {
  const { subscription, customer } =
    await fetchStripeSubscriptionWithCustomer(stripeSubscriptionId)
  const { primaryPayer, payerEmail, payerPhone } =
    await fetchFamilyPayerData(familyId)
  const { amount, interval, periodDates } =
    extractSubscriptionData(subscription)

  const existingDbSub = await getSubscriptionByStripeId(stripeSubscriptionId)
  const linkedFamilyId =
    existingDbSub?.assignments?.[0]?.programProfile?.familyReferenceId
  const isAlreadyLinked = Boolean(linkedFamilyId && linkedFamilyId !== familyId)

  let existingFamilyName: string | null = null
  if (isAlreadyLinked && linkedFamilyId) {
    const existingProfiles = await getProgramProfilesByFamilyId(linkedFamilyId)
    const guardian = existingProfiles[0]?.person.dependentRelationships?.find(
      (r) => r.isPrimaryPayer
    )?.guardian
    existingFamilyName = guardian?.name || 'Unknown Family'
  }

  const stripeCustomerName = customer.name || null
  const stripeCustomerEmail = customer.email || null

  const nameMismatch = Boolean(
    stripeCustomerName &&
      primaryPayer.name &&
      stripeCustomerName.toLowerCase() !== primaryPayer.name.toLowerCase()
  )
  const emailMismatch = Boolean(
    stripeCustomerEmail &&
      payerEmail &&
      stripeCustomerEmail.toLowerCase() !== payerEmail.toLowerCase()
  )

  return {
    subscriptionId: subscription.id,
    customerId: customer.id,
    status: subscription.status,
    amount,
    interval,
    periodStart: periodDates.periodStart || new Date(),
    periodEnd: periodDates.periodEnd || new Date(),
    stripeCustomerName,
    stripeCustomerEmail,
    dbPayerName: primaryPayer.name,
    dbPayerEmail: payerEmail,
    dbPayerPhone: payerPhone,
    hasMismatch: nameMismatch || emailMismatch,
    nameMismatch,
    emailMismatch,
    existingFamilyId: isAlreadyLinked ? (linkedFamilyId ?? null) : null,
    existingFamilyName: isAlreadyLinked ? existingFamilyName : null,
    isAlreadyLinked,
  }
}

/**
 * Consolidate a Stripe subscription with a family.
 *
 * Creates/updates BillingAccount, Subscription, and BillingAssignments.
 * Optionally syncs Stripe customer to match DB and updates metadata.
 */
export async function consolidateStripeSubscription(
  input: ConsolidateSubscriptionInput
): Promise<ConsolidateSubscriptionResult> {
  const {
    stripeSubscriptionId,
    familyId,
    syncStripeCustomer,
    forceOverride = false,
  } = input

  const stripe = getDugsiStripeClient()
  const { subscription, customer } =
    await fetchStripeSubscriptionWithCustomer(stripeSubscriptionId)
  const { familyProfiles, primaryPayer, payerEmail } =
    await fetchFamilyPayerData(familyId)

  const existingDbSub = await getSubscriptionByStripeId(stripeSubscriptionId)
  let previousFamilyUnlinked = false

  if (existingDbSub?.assignments && existingDbSub.assignments.length > 0) {
    const existingProfile = existingDbSub.assignments[0].programProfile
    const existingFamilyId = existingProfile?.familyReferenceId

    if (existingFamilyId && existingFamilyId !== familyId) {
      if (!forceOverride) {
        throw new ActionError(
          'Subscription is already linked to another family. Use forceOverride to move it.',
          'ALREADY_LINKED',
          undefined,
          409
        )
      }

      await unlinkSubscription(existingDbSub.id)
      previousFamilyUnlinked = true
      logger.info(
        {
          subscriptionId: stripeSubscriptionId,
          previousFamilyId: existingFamilyId,
        },
        'Unlinked subscription from previous family'
      )
    }
  }

  const billingAccount = await upsertBillingAccount({
    personId: primaryPayer.id,
    accountType: 'DUGSI',
    stripeCustomerIdDugsi: customer.id,
    paymentMethodCaptured: true,
    paymentMethodCapturedAt: new Date(),
  })

  const { amount, interval, periodDates } =
    extractSubscriptionData(subscription)
  const status = subscription.status as SubscriptionStatus
  let dbSubscription = existingDbSub

  if (!dbSubscription) {
    dbSubscription = await createSubscription({
      billingAccountId: billingAccount.id,
      stripeAccountType: 'DUGSI',
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customer.id,
      status,
      amount,
      currency: subscription.currency,
      interval,
      currentPeriodStart: periodDates.periodStart,
      currentPeriodEnd: periodDates.periodEnd,
      paidUntil: periodDates.periodEnd,
    })
    logger.info(
      { subscriptionId: subscription.id, dbSubscriptionId: dbSubscription.id },
      'Created subscription record in database'
    )
  } else {
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        billingAccountId: billingAccount.id,
        status,
        amount,
        currentPeriodStart: periodDates.periodStart,
        currentPeriodEnd: periodDates.periodEnd,
        paidUntil: periodDates.periodEnd,
      },
    })
    logger.info(
      { subscriptionId: subscription.id, dbSubscriptionId: dbSubscription.id },
      'Updated existing subscription record'
    )
  }

  const profileIds = familyProfiles.map((p) => p.id)
  const assignmentsCreated = await linkSubscriptionToProfiles(
    dbSubscription.id,
    profileIds,
    amount,
    'Consolidated via admin'
  )

  let stripeCustomerSynced = false
  if (syncStripeCustomer) {
    try {
      await stripe.customers.update(customer.id, {
        name: primaryPayer.name,
        email: payerEmail || undefined,
      })
      stripeCustomerSynced = true
      logger.info(
        { customerId: customer.id, newName: primaryPayer.name },
        'Synced Stripe customer to match DB'
      )
    } catch (error) {
      await logError(logger, error, 'Failed to sync Stripe customer', {
        customerId: customer.id,
      })
    }
  }

  const childNames = familyProfiles.map((p) => p.person.name).join(', ')
  const childCount = familyProfiles.length

  let stripeMetadataUpdated = false
  try {
    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        Family: primaryPayer.name,
        Children: childNames,
        Rate: formatRateDisplay(amount),
        Tier: getRateTierDescription(childCount),
        Source: 'admin-consolidation',
        familyId,
        guardianPersonId: primaryPayer.id,
        childCount: childCount.toString(),
        profileIds: profileIds.join(','),
        calculatedRate: amount.toString(),
        source: 'admin-consolidation',
      },
    })
    stripeMetadataUpdated = true
    logger.info(
      { subscriptionId: subscription.id, familyId },
      'Updated Stripe subscription metadata'
    )
  } catch (error) {
    await logError(logger, error, 'Failed to update Stripe metadata', {
      subscriptionId: subscription.id,
    })
  }

  logger.info(
    {
      subscriptionId: subscription.id,
      familyId,
      assignmentsCreated,
      stripeCustomerSynced,
      stripeMetadataUpdated,
      previousFamilyUnlinked,
    },
    'Subscription consolidation completed'
  )

  return {
    subscriptionId: subscription.id,
    billingAccountId: billingAccount.id,
    assignmentsCreated,
    stripeMetadataUpdated,
    stripeCustomerSynced,
    previousFamilyUnlinked,
  }
}
