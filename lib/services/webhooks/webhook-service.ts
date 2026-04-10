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
import Stripe from 'stripe'

import { prisma } from '@/lib/db'
import {
  getBillingAccountByStripeCustomerId,
  getSubscriptionByStripeId,
  getBillingAssignmentsBySubscription,
  updateSubscriptionStatus as updateSubscriptionStatusQuery,
} from '@/lib/db/queries/billing'
import {
  findGuardianWithBillableDugsiChildren,
  verifyDugsiProfileIdsForGuardian,
  findBillableDugsiProfileIdsForGuardian,
} from '@/lib/db/queries/dugsi-profiles'
import {
  findPersonById,
  findPersonByStripeCustomerId,
} from '@/lib/db/queries/person'
import type { DatabaseClient } from '@/lib/db/types'
import { createServiceLogger, logError } from '@/lib/logger'
import {
  createOrUpdateBillingAccount,
  linkSubscriptionToProfiles,
  unlinkSubscription,
} from '@/lib/services/shared/billing-service'
import { createSubscriptionFromStripe } from '@/lib/services/shared/subscription-service'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { validateAndNormalizeEmail } from '@/lib/utils/contact-normalization'
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

// ─── Types ──────────────────────────────────────────────────────────────────

type RecoverySource =
  | 'existing_billing_account'
  | 'metadata_person_id'
  | 'existing_person_by_customer'
  | 'dugsi_email_fallback'

interface DugsiRecoveryMetadata {
  guardianPersonId: string
  familyName: string
  familyId: string | null
  standardRate: number
  actualAmount: number
}

type ResolvedSubscriptionContext =
  | {
      billingAccount: { id: string; personId: string | null }
      effectiveProfileIds: string[]
      recoverySource: Exclude<RecoverySource, 'dugsi_email_fallback'>
    }
  | {
      billingAccount: { id: string; personId: string | null }
      effectiveProfileIds: string[]
      recoverySource: 'dugsi_email_fallback'
      dugsiRecoveryMetadata: DugsiRecoveryMetadata
    }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildNoPersonFoundError(customerId: string): Error {
  return new Error(
    `No person found for customer ${customerId}. Payment method must be captured first or subscription metadata must include personId/guardianPersonId.`
  )
}

function extractMetadataProfileIdHints(
  subscription: Stripe.Subscription
): string[] {
  const metadata = subscription.metadata ?? {}
  if (metadata.profileIds) {
    return metadata.profileIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  }
  if (metadata.profileId) {
    return [metadata.profileId]
  }
  return []
}

async function resolveDugsiProfileIds(
  billingAccount: { personId: string | null },
  subscription: Stripe.Subscription
): Promise<string[]> {
  const personId = billingAccount.personId
  if (!personId) {
    logger.warn(
      { subscriptionId: subscription.id },
      'resolveDugsiProfileIds: billing account has no personId — cannot resolve profile IDs'
    )
    Sentry.captureMessage(
      'Dugsi subscription created without profile links — billing account has no personId',
      {
        level: 'error',
        extra: { subscriptionId: subscription.id },
      }
    )
    return []
  }

  const hints = extractMetadataProfileIdHints(subscription)

  if (hints.length > 0) {
    const verified = await verifyDugsiProfileIdsForGuardian(personId, hints)

    if (verified.length > 0) {
      if (verified.length < hints.length) {
        logger.warn(
          {
            personId,
            subscriptionId: subscription.id,
            metadataProfileIds: hints,
            verifiedProfileIds: verified,
          },
          'Partial Dugsi profileId verification: some metadata IDs failed — using verified subset'
        )
      }
      return verified
    }

    logger.warn(
      {
        personId,
        subscriptionId: subscription.id,
        metadataProfileIds: hints,
      },
      'All Dugsi profileIds from Stripe metadata failed verification — falling back to DB derivation'
    )
  }

  const fallbackIds = await findBillableDugsiProfileIdsForGuardian(personId)

  if (fallbackIds.length === 0) {
    logger.warn(
      { personId, subscriptionId: subscription.id },
      'resolveDugsiProfileIds: no billable Dugsi profiles found via metadata or DB fallback — subscription will be created without profile links'
    )
    Sentry.captureMessage(
      'Dugsi subscription created without profile links — manual review required',
      {
        level: 'warning',
        extra: { personId, subscriptionId: subscription.id },
      }
    )
  }

  return fallbackIds
}

async function resolveDugsiFallbackFromCustomerEmail(
  subscription: Stripe.Subscription,
  customerId: string
): Promise<ResolvedSubscriptionContext> {
  const dugsiStripe = getDugsiStripeClient()

  let stripeCustomer: Stripe.Customer | Stripe.DeletedCustomer
  try {
    stripeCustomer = await dugsiStripe.customers.retrieve(customerId)
  } catch (stripeErr) {
    await logError(
      logger,
      stripeErr,
      'Path 4 fallback: Failed to retrieve Stripe customer',
      { customerId, subscriptionId: subscription.id }
    )
    throw stripeErr
  }

  const customerEmail = stripeCustomer.deleted ? null : stripeCustomer.email
  const normalizedEmail = validateAndNormalizeEmail(customerEmail)

  if (!normalizedEmail) {
    logger.warn(
      {
        customerId,
        subscriptionId: subscription.id,
        isDeleted: stripeCustomer.deleted ?? false,
      },
      'Path 4 fallback: Stripe customer has no email address, cannot resolve guardian'
    )
    throw buildNoPersonFoundError(customerId)
  }

  const guardian = await findGuardianWithBillableDugsiChildren(normalizedEmail)

  if (!guardian) {
    logger.warn(
      {
        customerId,
        subscriptionId: subscription.id,
      },
      'Path 4 fallback: Stripe customer email found but no matching Person record'
    )
    throw buildNoPersonFoundError(customerId)
  }

  const rawProfiles = guardian.guardianRelationships.flatMap(
    (rel) => rel.dependent.programProfiles
  )
  const familyProfiles = Array.from(
    new Map(rawProfiles.map((p) => [p.id, p])).values()
  )

  if (familyProfiles.length === 0) {
    logger.warn(
      {
        customerId,
        guardianPersonId: guardian.id,
        subscriptionId: subscription.id,
      },
      'Path 4 fallback: Cannot create billing account — guardian has no enrolled Dugsi children'
    )
    throw buildNoPersonFoundError(customerId)
  }

  // Unlike Paths 1-3 where createOrUpdateBillingAccount is called in the orchestrator,
  // Path 4 writes it here inside the resolver. On a retry, the billing account exists
  // so the orchestrator takes Path 1 instead — this is intentional and correct.
  const billingAccount = await createOrUpdateBillingAccount({
    personId: guardian.id,
    accountType: StripeAccountType.DUGSI,
    stripeCustomerId: customerId,
    paymentMethodCaptured: true,
    paymentMethodCapturedAt: new Date(subscription.created * 1000),
  })

  const effectiveProfileIds = familyProfiles.map((p) => p.id)
  const childCount = familyProfiles.length
  const familyId = familyProfiles[0]?.familyReferenceId ?? null

  const uniqueFamilyIds = new Set(
    familyProfiles.map((p) => p.familyReferenceId).filter(Boolean)
  )
  if (uniqueFamilyIds.size > 1) {
    logger.warn(
      {
        guardianPersonId: guardian.id,
        familyIds: [...uniqueFamilyIds],
        subscriptionId: subscription.id,
      },
      'Path 4 fallback: guardian spans multiple families — using first family ID'
    )
  }

  const standardRate = calculateDugsiRate(childCount)
  const actualAmount =
    subscription.items.data[0]?.price?.unit_amount ?? standardRate

  if (actualAmount !== standardRate) {
    logger.warn(
      {
        subscriptionId: subscription.id,
        customerId,
        guardianPersonId: guardian.id,
        stripeAmount: actualAmount,
        calculatedRate: standardRate,
        childCount,
      },
      'Path 4 fallback: Stripe amount differs from calculated Dugsi rate — custom rate in use'
    )
  }

  return {
    billingAccount,
    effectiveProfileIds,
    recoverySource: 'dugsi_email_fallback',
    dugsiRecoveryMetadata: {
      guardianPersonId: guardian.id,
      familyName: guardian.name,
      familyId,
      standardRate,
      actualAmount,
    },
  }
}

async function resolveSubscriptionContext(
  subscription: Stripe.Subscription,
  accountType: StripeAccountType,
  customerId: string
): Promise<ResolvedSubscriptionContext> {
  // Path 1: billing account already exists for this Stripe customer
  const existingBillingAccount = await getBillingAccountByStripeCustomerId(
    customerId,
    accountType
  )

  if (existingBillingAccount) {
    const effectiveProfileIds =
      accountType === StripeAccountType.DUGSI
        ? await resolveDugsiProfileIds(existingBillingAccount, subscription)
        : extractMetadataProfileIdHints(subscription)

    return {
      billingAccount: existingBillingAccount,
      effectiveProfileIds,
      recoverySource: 'existing_billing_account',
    }
  }

  // Path 2: personId or guardianPersonId present in Stripe subscription metadata
  const metadataPersonId =
    subscription.metadata?.personId || subscription.metadata?.guardianPersonId

  if (metadataPersonId) {
    const verifiedPerson = await findPersonById(metadataPersonId)

    if (verifiedPerson) {
      logger.info(
        {
          customerId,
          personId: metadataPersonId,
          subscriptionId: subscription.id,
        },
        'Creating billing account from subscription metadata'
      )

      const billingAccount = await createOrUpdateBillingAccount({
        personId: metadataPersonId,
        accountType,
        stripeCustomerId: customerId,
        paymentMethodCaptured: true,
        paymentMethodCapturedAt: new Date(subscription.created * 1000),
      })

      const effectiveProfileIds =
        accountType === StripeAccountType.DUGSI
          ? await resolveDugsiProfileIds(billingAccount, subscription)
          : extractMetadataProfileIdHints(subscription)

      return {
        billingAccount,
        effectiveProfileIds,
        recoverySource: 'metadata_person_id',
      }
    }

    // Person ID in metadata not found in DB — fall through to Path 3
    logger.warn(
      { customerId, metadataPersonId, subscriptionId: subscription.id },
      'Path 2: metadataPersonId not found in DB — falling through to Path 3'
    )
    Sentry.captureMessage(
      'Subscription metadata contains personId not found in database',
      {
        level: 'warning',
        extra: {
          customerId,
          metadataPersonId,
          subscriptionId: subscription.id,
        },
      }
    )
  }

  // Path 3: cross-program person lookup — finds a person via any billing account already
  // linked to this Stripe customer ID (searches both Mahad and Dugsi customer ID columns)
  const existingPerson = await findPersonByStripeCustomerId(customerId)

  if (existingPerson) {
    const billingAccount = await createOrUpdateBillingAccount({
      personId: existingPerson.id,
      accountType,
      stripeCustomerId: customerId,
    })

    const effectiveProfileIds =
      accountType === StripeAccountType.DUGSI
        ? await resolveDugsiProfileIds(billingAccount, subscription)
        : extractMetadataProfileIdHints(subscription)

    return {
      billingAccount,
      effectiveProfileIds,
      recoverySource: 'existing_person_by_customer',
    }
  }

  // Path 4: Dugsi-only email fallback for subscriptions manually created in the Stripe dashboard
  if (accountType === StripeAccountType.DUGSI) {
    return resolveDugsiFallbackFromCustomerEmail(subscription, customerId)
  }

  throw buildNoPersonFoundError(customerId)
}

async function patchRecoveredDugsiMetadata(
  subscriptionId: string,
  customerId: string,
  recovery: DugsiRecoveryMetadata,
  effectiveProfileIds: string[]
): Promise<void> {
  const dugsiStripe = getDugsiStripeClient()

  const childCount = effectiveProfileIds.length

  // Emit observability signals unconditionally — DB writes are already committed at this point.
  // The Stripe metadata patch below is best-effort; these signals must not depend on its success.
  Sentry.captureMessage(
    'Dugsi subscription resolved via customer email fallback',
    {
      level: 'info',
      extra: {
        customerId,
        subscriptionId,
        guardianPersonId: recovery.guardianPersonId,
        childCount,
        derivedProfileIds: effectiveProfileIds,
      },
    }
  )

  logger.warn(
    {
      customerId,
      subscriptionId,
      guardianPersonId: recovery.guardianPersonId,
      childCount,
    },
    'Subscription created without metadata — resolved via Stripe customer email fallback'
  )

  try {
    await dugsiStripe.subscriptions.update(subscriptionId, {
      metadata: {
        guardianPersonId: recovery.guardianPersonId,
        ...(recovery.familyId ? { familyId: recovery.familyId } : {}),
        childCount: String(childCount),
        profileIds: effectiveProfileIds.join(','),
        calculatedRate: String(recovery.standardRate),
        overrideUsed: String(recovery.actualAmount !== recovery.standardRate),
        familyName: recovery.familyName,
        source: 'dugsi-webhook-fallback-recovery',
      },
    })
  } catch (metadataErr) {
    const isTransientError =
      metadataErr instanceof Stripe.errors.StripeConnectionError ||
      metadataErr instanceof Stripe.errors.StripeRateLimitError

    if (isTransientError) {
      await logError(
        logger,
        metadataErr,
        'Path 4 fallback: transient Stripe error — metadata patch skipped, subscription saved successfully',
        { subscriptionId, customerId }
      )
      return
    }

    // Non-transient errors are also swallowed — billing data is already committed
    // and the metadata patch is best-effort. Sentry alert fires so on-call can investigate.
    Sentry.captureException(metadataErr, {
      extra: {
        subscriptionId,
        customerId,
        guardianPersonId: recovery.guardianPersonId,
      },
    })
    await logError(
      logger,
      metadataErr,
      'Path 4 fallback: Failed to patch Stripe subscription metadata — manual update required',
      {
        subscriptionId,
        customerId,
        guardianPersonId: recovery.guardianPersonId,
      }
    )
  }
}

function validateMahadRateIfPresent(subscription: Stripe.Subscription): void {
  const metadata = subscription.metadata || {}
  if (
    !metadata.calculatedRate ||
    !metadata.graduationStatus ||
    !metadata.paymentFrequency ||
    !metadata.billingType
  ) {
    return
  }

  const priceAmount = subscription.items?.data?.[0]?.price?.unit_amount
  const expectedRate = parseInt(metadata.calculatedRate, 10)

  const actualCalculatedRate = calculateMahadRate(
    metadata.graduationStatus as GraduationStatus,
    metadata.paymentFrequency as PaymentFrequency,
    metadata.billingType as StudentBillingType
  )

  if (priceAmount !== expectedRate) {
    logger.warn(
      {
        subscriptionId: subscription.id,
        stripeAmount: priceAmount,
        expectedRate,
        graduationStatus: metadata.graduationStatus,
        paymentFrequency: metadata.paymentFrequency,
        billingType: metadata.billingType,
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
        graduationStatus: metadata.graduationStatus,
        paymentFrequency: metadata.paymentFrequency,
        billingType: metadata.billingType,
      },
      'Rate calculation mismatch: Stored metadata rate differs from recalculated rate'
    )
  }

  if (priceAmount === expectedRate && actualCalculatedRate === expectedRate) {
    logger.info(
      {
        subscriptionId: subscription.id,
        profileId: metadata.profileId,
        studentName: metadata.studentName,
        stripeAmount: priceAmount,
        expectedRate,
        graduationStatus: metadata.graduationStatus,
        paymentFrequency: metadata.paymentFrequency,
        billingType: metadata.billingType,
      },
      'Mahad subscription rate validation completed'
    )
  }
}

function validateDugsiRateIfPresent(subscription: Stripe.Subscription): void {
  const metadata = subscription.metadata || {}
  if (!metadata.calculatedRate || !metadata.childCount) return

  const priceAmount = subscription.items?.data?.[0]?.price?.unit_amount
  const expectedRate = parseInt(metadata.calculatedRate, 10)
  const childCount = parseInt(metadata.childCount, 10)

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

  if (priceAmount === expectedRate && actualCalculatedRate === expectedRate) {
    logger.info(
      {
        subscriptionId: subscription.id,
        stripeAmount: priceAmount,
        expectedRate,
        childCount,
      },
      'Dugsi subscription rate validation completed'
    )
  }
}

async function linkProfilesIfPresent(
  dbSubscriptionId: string,
  profileIds: string[],
  subscription: Stripe.Subscription
): Promise<void> {
  if (profileIds.length === 0) return

  if (!subscription.items?.data?.length) {
    const error = new Error('Subscription has no items')
    await logError(
      logger,
      error,
      'Subscription has no items - cannot link to profiles',
      { subscriptionId: subscription.id }
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
      { subscriptionId: subscription.id, priceAmount }
    )
    throw error
  }

  await Sentry.startSpan(
    {
      name: 'subscription.link_profiles',
      op: 'db.transaction',
      attributes: {
        subscription_id: dbSubscriptionId,
        num_profiles: profileIds.length,
        amount: priceAmount,
      },
    },
    async () =>
      await linkSubscriptionToProfiles(
        dbSubscriptionId,
        profileIds,
        priceAmount,
        'Linked automatically via webhook'
      )
  )
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Handle subscription creation event.
 *
 * Called when customer.subscription.created event is received.
 * Creates subscription in database and links to profiles.
 *
 * @param subscription - Stripe subscription object
 * @param accountType - Stripe account type
 * @returns Subscription event result
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  accountType: StripeAccountType
): Promise<SubscriptionEventResult> {
  const customerId = extractCustomerId(subscription.customer)

  if (!customerId) {
    throw new Error('Invalid customer ID in subscription')
  }

  const resolved = await resolveSubscriptionContext(
    subscription,
    accountType,
    customerId
  )

  const dbSubscription = await Sentry.startSpan(
    {
      name: 'subscription.create_from_stripe',
      op: 'db.transaction',
      attributes: {
        account_type: accountType,
        stripe_subscription_id: subscription.id,
        billing_account_id: resolved.billingAccount.id,
      },
    },
    async () =>
      await createSubscriptionFromStripe(
        subscription,
        resolved.billingAccount.id,
        accountType
      )
  )

  if (accountType === StripeAccountType.MAHAD) {
    validateMahadRateIfPresent(subscription)
  }

  if (accountType === StripeAccountType.DUGSI) {
    // For Path 4 subscriptions this is a no-op: metadata is empty on first delivery.
    // Path 4's own rate check runs inside resolveDugsiFallbackFromCustomerEmail.
    validateDugsiRateIfPresent(subscription)
  }

  if (resolved.recoverySource === 'dugsi_email_fallback') {
    await patchRecoveredDugsiMetadata(
      subscription.id,
      customerId,
      resolved.dugsiRecoveryMetadata,
      resolved.effectiveProfileIds
    )
  }

  await linkProfilesIfPresent(
    dbSubscription.id,
    resolved.effectiveProfileIds,
    subscription
  )

  if (accountType === StripeAccountType.MAHAD) {
    revalidateTag('mahad-students')
  } else if (accountType === StripeAccountType.DUGSI) {
    revalidateTag('dugsi-registrations')
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
  subscription: Stripe.Subscription,
  accountType: StripeAccountType
): Promise<SubscriptionEventResult> {
  const stripeSubscriptionId = subscription.id

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

  const status = subscription.status as SubscriptionStatus
  if (!isValidSubscriptionStatus(status)) {
    throw new Error(`Invalid subscription status: ${status}`)
  }

  const periodDates = extractPeriodDates(subscription)

  await updateSubscriptionStatusQuery(dbSubscription.id, status, {
    currentPeriodStart: periodDates.periodStart,
    currentPeriodEnd: periodDates.periodEnd,
    paidUntil: periodDates.periodEnd,
  })

  if (accountType === StripeAccountType.MAHAD) {
    revalidateTag('mahad-students')
  } else if (accountType === StripeAccountType.DUGSI) {
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

  await prisma.$transaction(async (tx) => {
    await updateSubscriptionStatusQuery(
      dbSubscription.id,
      'canceled',
      undefined,
      tx
    )
    await unlinkSubscription(dbSubscription.id, tx)
  })

  if (accountType === StripeAccountType.MAHAD) {
    revalidateTag('mahad-students')
  } else if (accountType === StripeAccountType.DUGSI) {
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

  const dbSubscription = await getSubscriptionByStripeId(subscriptionId)

  if (!dbSubscription) {
    logger.warn(
      { subscriptionId, invoiceId: invoice.id },
      'Subscription not found for invoice'
    )
    return null
  }

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

  if (accountType === StripeAccountType.MAHAD) {
    revalidateTag('mahad-students')
  } else if (accountType === StripeAccountType.DUGSI) {
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
