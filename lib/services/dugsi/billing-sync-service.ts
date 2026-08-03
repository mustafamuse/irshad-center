import { EnrollmentStatus, Prisma } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  createBillingAssignment,
  deactivateBillingAssignmentsForProfiles,
  findFamilyLiveSubscriptions,
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
import { isPrismaError } from '@/lib/utils/type-guards'

import {
  findFamilySubscription,
  findLiveFamilySubscriptionIds,
  handleBillingDivergence,
} from './billing-helpers'
import { updateDugsiSubscriptionPricing } from './subscription-pricing'

const logger = createServiceLogger('dugsi-billing-sync')

const ROSTER_STATUSES: EnrollmentStatus[] = ['REGISTERED', 'ENROLLED']

const syncTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
}

export interface SyncFamilyBillingResult {
  synced: boolean
  rate: number
  childCount: number
  warning?: string
}

// Roster and subscription lookup happen OUTSIDE any transaction — the spec's
// Stripe-first ordering (roster/rate must be known before the Stripe call,
// and the Stripe call can't happen inside a DB transaction) makes a single
// consistent snapshot across the whole function impossible. But the
// assignment partition (update vs create, and which assignments are stale)
// is computed from a Serializable, in-transaction re-read of active
// assignments, not the pre-Stripe snapshot: two overlapping syncs for the
// same family therefore can't both insert an assignment for the same
// (subscriptionId, programProfileId). A serialization conflict (P2034)
// surfaces as a retryable 409 instead of silently corrupting assignments.
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

  let subscription = await findFamilySubscription(familyReferenceId)
  if (!subscription) {
    // No ACTIVE assignment means findFamilySubscription can't see it — this
    // covers a fully-withdrawn family whose Stripe subscription is still live
    // with cancel_at_period_end pending. Fall back to a family-scoped lookup
    // that doesn't require an active assignment before giving up.
    const liveSubscriptions =
      await findFamilyLiveSubscriptions(familyReferenceId)
    if (liveSubscriptions.length > 1) {
      throw new ActionError(
        'This family has multiple active subscriptions. Consolidate billing before recalculating.',
        ERROR_CODES.ACTIVE_SUBSCRIPTION,
        undefined,
        409
      )
    }
    subscription = liveSubscriptions[0] ?? null
  }

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

  const rosterProfileIds = new Set(roster.map((p) => p.id))

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
    if (error instanceof ActionError) throw error
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

  let overrideWarning: string | undefined
  try {
    const now = new Date()
    await prisma.$transaction(async (tx) => {
      const existingAssignments =
        await getActiveBillingAssignmentsForSubscription(subscription.id, tx)
      const rosterAssignments = existingAssignments.filter((a) =>
        rosterProfileIds.has(a.programProfileId)
      )
      const staleAssignments = existingAssignments.filter(
        (a) => !rosterProfileIds.has(a.programProfileId)
      )
      overrideWarning =
        subscription.amount !== rate &&
        subscription.amount !== calculateDugsiRate(rosterAssignments.length)
          ? 'Admin override was replaced by the calculated rate'
          : undefined

      const byProfile = new Map(
        rosterAssignments.map((a) => [a.programProfileId, a])
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
      if (staleAssignments.length > 0) {
        await deactivateBillingAssignmentsForProfiles(
          staleAssignments.map((a) => a.programProfileId),
          now,
          tx
        )
      }
      await updateSubscriptionAmount(subscription.id, rate, tx)
    }, syncTransactionOptions)
  } catch (dbError) {
    if (isPrismaError(dbError) && dbError.code === 'P2034') {
      throw new ActionError(
        'Another billing update for this family is in progress. Please try again.',
        ERROR_CODES.INVALID_INPUT,
        undefined,
        409
      )
    }
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
