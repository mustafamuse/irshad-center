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
import {
  extractPeriodDates,
  isValidSubscriptionStatus,
} from '@/lib/utils/type-guards'

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

function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  return isValidSubscriptionStatus(stripeStatus)
    ? (stripeStatus as SubscriptionStatus)
    : 'incomplete'
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
  syncError?: string
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
    existingFamilyName = guardian?.name ?? 'Unknown Family'
  }

  const stripeCustomerName = customer.name ?? null
  const stripeCustomerEmail = customer.email ?? null

  const caseInsensitiveMatch = (a: string | null, b: string | null) =>
    a && b && a.toLowerCase() === b.toLowerCase()

  const nameMismatch =
    !!stripeCustomerName &&
    !caseInsensitiveMatch(stripeCustomerName, primaryPayer.name)
  const emailMismatch =
    !!stripeCustomerEmail &&
    !caseInsensitiveMatch(stripeCustomerEmail, payerEmail)

  return {
    subscriptionId: subscription.id,
    customerId: customer.id,
    status: subscription.status,
    amount,
    interval,
    periodStart: periodDates.periodStart ?? new Date(),
    periodEnd: periodDates.periodEnd ?? new Date(),
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
 * All DB operations are wrapped in a transaction for atomicity.
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

  // Check for existing link before transaction
  let existingFamilyId: string | null = null
  if (existingDbSub?.assignments && existingDbSub.assignments.length > 0) {
    const existingProfile = existingDbSub.assignments[0].programProfile
    existingFamilyId = existingProfile?.familyReferenceId ?? null

    if (existingFamilyId && existingFamilyId !== familyId && !forceOverride) {
      throw new ActionError(
        'Subscription is already linked to another family. Use forceOverride to move it.',
        ERROR_CODES.ALREADY_LINKED,
        undefined,
        409
      )
    }
  }

  const { amount, interval, periodDates } =
    extractSubscriptionData(subscription)
  const status = mapStripeStatus(subscription.status)
  const profileIds = familyProfiles.map((p) => p.id)

  // Wrap all DB operations in a transaction for atomicity
  const txResult = await prisma.$transaction(
    async (tx) => {
      let previousFamilyUnlinked = false

      // Unlink from previous family if needed
      if (existingFamilyId && existingFamilyId !== familyId && existingDbSub) {
        await unlinkSubscription(existingDbSub.id, tx)
        previousFamilyUnlinked = true
        logger.info(
          {
            subscriptionId: stripeSubscriptionId,
            previousFamilyId: existingFamilyId,
          },
          'Unlinked subscription from previous family'
        )
      }

      // Create/update billing account
      const billingAccount = await upsertBillingAccount(
        {
          personId: primaryPayer.id,
          accountType: 'DUGSI',
          stripeCustomerIdDugsi: customer.id,
          paymentMethodCaptured: true,
          paymentMethodCapturedAt: new Date(),
        },
        tx
      )

      // Create or update subscription
      let dbSubscription = existingDbSub
      if (!dbSubscription) {
        dbSubscription = await createSubscription(
          {
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
          },
          tx
        )
        logger.info(
          {
            subscriptionId: subscription.id,
            dbSubscriptionId: dbSubscription.id,
          },
          'Created subscription record in database'
        )
      } else {
        await tx.subscription.update({
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
          {
            subscriptionId: subscription.id,
            dbSubscriptionId: dbSubscription.id,
          },
          'Updated existing subscription record'
        )
      }

      // Link subscription to family profiles
      const assignmentsCreated = await linkSubscriptionToProfiles(
        dbSubscription.id,
        profileIds,
        amount,
        'Consolidated via admin',
        tx
      )

      return {
        billingAccountId: billingAccount.id,
        assignmentsCreated,
        previousFamilyUnlinked,
      }
    },
    { timeout: 30000 }
  )

  let stripeCustomerSynced = false
  let syncError: string | undefined
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
      syncError =
        error instanceof Error
          ? error.message
          : 'Failed to sync Stripe customer'
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
      assignmentsCreated: txResult.assignmentsCreated,
      stripeCustomerSynced,
      stripeMetadataUpdated,
      previousFamilyUnlinked: txResult.previousFamilyUnlinked,
    },
    'Subscription consolidation completed'
  )

  return {
    subscriptionId: subscription.id,
    billingAccountId: txResult.billingAccountId,
    assignmentsCreated: txResult.assignmentsCreated,
    stripeMetadataUpdated,
    stripeCustomerSynced,
    previousFamilyUnlinked: txResult.previousFamilyUnlinked,
    syncError,
  }
}
