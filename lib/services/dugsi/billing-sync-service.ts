import { EnrollmentStatus } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  createBillingAssignment,
  getActiveBillingAssignmentsForSubscription,
  updateBillingAssignmentAmount,
  updateSubscriptionAmount,
} from '@/lib/db/queries/billing'
import { findFamilyProfilesForWithdrawal } from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError, logInfo } from '@/lib/logger'
import { calculateSplitAmounts } from '@/lib/services/shared/billing-service'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'

import {
  findFamilySubscription,
  findLiveFamilySubscriptionIds,
  handleBillingDivergence,
} from './billing-helpers'
import { updateDugsiSubscriptionPricing } from './subscription-pricing'

const logger = createServiceLogger('dugsi-billing-sync')

const ROSTER_STATUSES: EnrollmentStatus[] = ['REGISTERED', 'ENROLLED']

export interface SyncFamilyBillingResult {
  synced: boolean
  rate: number
  childCount: number
  warning?: string
}

export async function syncFamilyBillingRate(
  familyReferenceId: string
): Promise<SyncFamilyBillingResult> {
  const liveSubscriptionIds =
    await findLiveFamilySubscriptionIds(familyReferenceId)
  if (liveSubscriptionIds.length > 1) {
    throw new ActionError(
      'This family has multiple active subscriptions. Consolidate billing before recalculating.',
      ERROR_CODES.ACTIVE_SUBSCRIPTION,
      undefined,
      409
    )
  }

  const roster = await findFamilyProfilesForWithdrawal(
    familyReferenceId,
    DUGSI_PROGRAM,
    ROSTER_STATUSES
  )
  const childCount = roster.length
  const rate = calculateDugsiRate(childCount)

  if (childCount === 0) {
    return {
      synced: false,
      rate,
      childCount,
      warning: 'No active children — nothing to sync',
    }
  }

  const subscription = await findFamilySubscription(familyReferenceId)
  if (!subscription) {
    return {
      synced: false,
      rate,
      childCount,
      warning: 'No active subscription — family needs a new checkout',
    }
  }

  const splits = calculateSplitAmounts(rate, childCount)
  if (splits.some((amount) => amount <= 0)) {
    throw new ActionError(
      'Calculated rate would create zero-amount billing assignments',
      ERROR_CODES.INVALID_INPUT
    )
  }

  const existingAssignments = await getActiveBillingAssignmentsForSubscription(
    subscription.id
  )
  const overrideWarning =
    subscription.amount !== rate &&
    subscription.amount !== calculateDugsiRate(existingAssignments.length)
      ? 'Admin override was replaced by the calculated rate'
      : undefined

  const stripe = getDugsiStripeClient()
  try {
    await updateDugsiSubscriptionPricing(
      stripe,
      subscription.stripeSubscriptionId,
      rate,
      roster.map((p) => ({ id: p.id, name: p.person.name })),
      { clearCancelAtPeriodEnd: true }
    )
  } catch (error) {
    await logError(logger, error, 'Stripe update failed during billing sync', {
      familyReferenceId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      intendedAmount: rate,
    })
    throw new ActionError(
      'Stripe billing update failed. Roster is saved; use Recalculate rate to retry.',
      ERROR_CODES.STRIPE_ERROR
    )
  }

  try {
    await prisma.$transaction(async (tx) => {
      const byProfile = new Map(
        existingAssignments.map((a) => [a.programProfileId, a])
      )
      for (const [index, profile] of roster.entries()) {
        const share = splits[index]
        const existing = byProfile.get(profile.id)
        if (existing) {
          await updateBillingAssignmentAmount(existing.id, share, tx)
        } else {
          await createBillingAssignment(
            {
              subscriptionId: subscription.id,
              programProfileId: profile.id,
              amount: share,
            },
            tx
          )
        }
      }
      await updateSubscriptionAmount(subscription.id, rate, tx)
    })
  } catch (dbError) {
    const warning = await handleBillingDivergence(
      logger,
      dbError,
      `Stripe updated to ${rate} cents`,
      {
        familyReferenceId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        intendedAmount: rate,
      }
    )
    return { synced: true, rate, childCount, warning }
  }

  await logInfo(logger, 'Family billing rate synced', {
    familyReferenceId,
    childCount,
    rate,
  })

  return { synced: true, rate, childCount, warning: overrideWarning }
}
