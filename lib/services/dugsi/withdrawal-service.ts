import { EnrollmentStatus, Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  deactivateBillingAssignmentsForProfiles,
  getActiveBillingAssignmentsForProfiles,
  reactivateBillingAssignmentsForProfiles,
  updateBillingAssignmentAmount,
  updateSubscriptionAmount,
} from '@/lib/db/queries/billing'
import {
  deactivateClassEnrollmentsForProfiles,
  reactivateClassEnrollmentsForProfiles,
} from '@/lib/db/queries/dugsi-class'
import {
  getActiveEnrollmentsForProfiles,
  restoreEnrollmentState,
  withdrawEnrollmentsByIds,
} from '@/lib/db/queries/enrollment'
import {
  findFamilyProfilesForWithdrawal,
  updateProgramProfileStatus,
  updateProgramProfileStatusMany,
} from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import {
  createServiceLogger,
  logError,
  logInfo,
  logWarning,
} from '@/lib/logger'
import { calculateSplitAmounts } from '@/lib/services/shared/billing-service'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { isValidStatusTransition } from '@/lib/types/enrollment'
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'
import { isPrismaError } from '@/lib/utils/type-guards'

import {
  findFamilySubscription,
  findLiveFamilySubscriptionIds,
  handleBillingDivergence,
} from './billing-helpers'
import { updateDugsiSubscriptionPricing } from './subscription-pricing'

const logger = createServiceLogger('dugsi-withdrawal')

const WITHDRAWABLE_STATUSES: EnrollmentStatus[] = ['REGISTERED', 'ENROLLED']

const WITHDRAWAL_REASON = 'Withdrawn by admin'

const withdrawalTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
}

// Connection-level failures (timeout, dropped socket) mean the response was
// never received — Stripe may or may not have applied the change. Rolling back
// the DB on that ambiguity could silently diverge from a Stripe that DID
// apply it, so these are surfaced as unknown-state instead of rolled back.
function isAmbiguousStripeOutcome(error: unknown): boolean {
  return (
    error instanceof Error &&
    'type' in error &&
    (error as { type?: string }).type === 'StripeConnectionError'
  )
}

export interface WithdrawChildrenResult {
  success: boolean
  error?: string
  warning?: string
  withdrawnCount: number
  remainingCount: number
  newRate: number
  previousRate: number
  subscriptionCanceled: boolean
}

interface EnrollmentRollbackState {
  id: string
  status: EnrollmentStatus
  endDate: Date | null
  reason: string | null
}

interface WithdrawnProfile {
  id: string
  status: EnrollmentStatus
  name: string
}

export async function withdrawChildren(
  familyReferenceId: string,
  requestedProfileIds: string[],
  reason: string = WITHDRAWAL_REASON
): Promise<WithdrawChildrenResult> {
  const profileIds = Array.from(new Set(requestedProfileIds))
  return Sentry.startSpan(
    { name: 'withdrawal.withdrawChildren', op: 'function' },
    async () => {
      const now = new Date()

      // Profiles, the family subscription, and the multi-subscription guard
      // are all read inside the transaction so the rate math and the Stripe
      // update work from one consistent snapshot. Serializable isolation
      // makes two overlapping withdrawals of different siblings conflict
      // instead of both computing rates from the same stale state.
      const runWithdrawalTransaction = () =>
        prisma.$transaction(async (tx) => {
          // Per-child rate math assumes one live subscription covers the
          // family. Legacy families can have siblings split across
          // subscriptions — those must be consolidated first or the wrong
          // subscription gets repriced.
          const liveSubscriptionIds = await findLiveFamilySubscriptionIds(
            familyReferenceId,
            tx
          )
          if (liveSubscriptionIds.length > 1) {
            throw new ActionError(
              'This family has multiple active subscriptions. Consolidate billing before withdrawing children.',
              ERROR_CODES.ACTIVE_SUBSCRIPTION,
              undefined,
              409
            )
          }

          const subscription = await findFamilySubscription(
            familyReferenceId,
            tx
          )

          const allFamilyProfiles = await findFamilyProfilesForWithdrawal(
            familyReferenceId,
            DUGSI_PROGRAM,
            WITHDRAWABLE_STATUSES,
            tx
          )

          if (allFamilyProfiles.length === 0) {
            throw new ActionError(
              'No active children found for this family',
              ERROR_CODES.FAMILY_NOT_FOUND
            )
          }

          const toWithdraw: WithdrawnProfile[] = allFamilyProfiles
            .filter((p) => profileIds.includes(p.id))
            .map((p) => ({
              id: p.id,
              status: p.status as EnrollmentStatus,
              name: p.person.name,
            }))

          if (toWithdraw.length !== profileIds.length) {
            const foundIds = new Set(toWithdraw.map((p) => p.id))
            const missing = profileIds.filter((id) => !foundIds.has(id))
            throw new ActionError(
              `Some children not found or not eligible for withdrawal: ${missing.join(', ')}`,
              ERROR_CODES.INVALID_INPUT
            )
          }

          const remaining: WithdrawnProfile[] = allFamilyProfiles
            .filter((p) => !profileIds.includes(p.id))
            .map((p) => ({
              id: p.id,
              status: p.status as EnrollmentStatus,
              name: p.person.name,
            }))

          const updated = await updateProgramProfileStatusMany(
            profileIds,
            'WITHDRAWN',
            WITHDRAWABLE_STATUSES,
            tx
          )
          if (updated.count !== profileIds.length) {
            throw new ActionError(
              'Some children changed status during withdrawal. Please refresh and try again.',
              ERROR_CODES.INVALID_INPUT
            )
          }

          await deactivateBillingAssignmentsForProfiles(profileIds, now, tx)

          // Re-split the new tier rate across the surviving assignments so
          // assignment sums keep matching the subscription amount.
          const assignmentRollbacks: { id: string; amount: number }[] = []
          if (subscription && remaining.length > 0) {
            const remainingAssignments =
              await getActiveBillingAssignmentsForProfiles(
                remaining.map((p) => p.id),
                subscription.id,
                tx
              )
            if (remainingAssignments.length > 0) {
              const splits = calculateSplitAmounts(
                calculateDugsiRate(remaining.length),
                remainingAssignments.length
              )
              if (splits.some((amount) => amount <= 0)) {
                throw new ActionError(
                  'Cannot re-split subscription amount: would create zero-amount billing assignments',
                  ERROR_CODES.INVALID_INPUT
                )
              }
              for (let i = 0; i < remainingAssignments.length; i++) {
                assignmentRollbacks.push({
                  id: remainingAssignments[i].id,
                  amount: remainingAssignments[i].amount,
                })
                await updateBillingAssignmentAmount(
                  remainingAssignments[i].id,
                  splits[i],
                  tx
                )
              }
            }
          }

          const activeEnrollments = await getActiveEnrollmentsForProfiles(
            profileIds,
            tx
          )
          const enrollmentStates: EnrollmentRollbackState[] = activeEnrollments
            .filter((e) => isValidStatusTransition(e.status, 'WITHDRAWN'))
            .map((e) => ({
              id: e.id,
              status: e.status,
              endDate: e.endDate,
              reason: e.reason,
            }))
          if (enrollmentStates.length > 0) {
            await withdrawEnrollmentsByIds(
              enrollmentStates.map((e) => e.id),
              reason,
              now,
              tx
            )
          }

          await deactivateClassEnrollmentsForProfiles(profileIds, now, tx)

          return {
            subscription,
            profilesToWithdraw: toWithdraw,
            remainingProfiles: remaining,
            withdrawnEnrollments: enrollmentStates,
            assignmentRollbacks,
          }
        }, withdrawalTransactionOptions)

      let txnResult: Awaited<ReturnType<typeof runWithdrawalTransaction>>
      try {
        txnResult = await runWithdrawalTransaction()
      } catch (error) {
        if (isPrismaError(error) && error.code === 'P2034') {
          throw new ActionError(
            'Another billing update for this family is in progress. Please try again.',
            ERROR_CODES.INVALID_INPUT,
            undefined,
            409
          )
        }
        throw error
      }

      const {
        subscription,
        profilesToWithdraw,
        remainingProfiles,
        withdrawnEnrollments,
        assignmentRollbacks,
      } = txnResult

      const withdrawCount = profilesToWithdraw.length
      const remainingCount = remainingProfiles.length
      const currentActiveCount = withdrawCount + remainingCount
      const allWithdrawn = remainingCount === 0

      const newRate = calculateDugsiRate(remainingCount)
      const previousRate =
        subscription?.amount ?? calculateDugsiRate(currentActiveCount)

      const originalStatuses = profilesToWithdraw.map((p) => ({
        id: p.id,
        status: p.status,
      }))

      const childNames = profilesToWithdraw.map((p) => p.name).join(', ')

      await logInfo(logger, 'Children withdrawn from Dugsi', {
        familyReferenceId,
        withdrawnChildren: childNames,
        withdrawCount,
        remainingCount,
        previousRate,
        newRate,
        enrollmentsWithdrawn: withdrawnEnrollments.length,
      })

      if (!subscription) {
        return {
          success: true,
          withdrawnCount: withdrawCount,
          remainingCount,
          newRate,
          previousRate,
          subscriptionCanceled: false,
        }
      }

      const calculatedPreviousRate = calculateDugsiRate(currentActiveCount)
      let warning: string | undefined
      if (subscription.amount !== calculatedPreviousRate) {
        warning = `Admin override amount was reset from $${(subscription.amount / 100).toFixed(2)} to calculated rate $${(newRate / 100).toFixed(2)}`
        await logWarning(logger, 'Admin override reset during withdrawal', {
          familyReferenceId,
          previousOverride: subscription.amount,
          newCalculatedRate: newRate,
        })
      }

      const stripe = getDugsiStripeClient()

      // Paused subscriptions take the same path: Stripe applies price changes
      // and cancel_at_period_end while collection is paused, so a later resume
      // bills at the post-withdrawal rate instead of the stale one.
      //
      // Only Stripe-mutating calls and their prerequisites live inside this
      // try — an API-level failure here means Stripe rejected the change, so
      // the compensating DB rollback is truthful. Connection-level failures
      // are the exception: the outcome is unknown, so the catch surfaces them
      // as unknown-state instead of rolling back. Post-success DB sync and
      // logging happen after the catch and are treated as divergence, never
      // as rollback.
      try {
        if (allWithdrawn) {
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
            metadata: {
              Children: '',
              Rate: '',
              Tier: '',
              childCount: '0',
              calculatedRate: '0',
              profileIds: '',
            },
          })
        } else {
          await updateDugsiSubscriptionPricing(
            stripe,
            subscription.stripeSubscriptionId,
            newRate,
            remainingProfiles.map((p) => ({ id: p.id, name: p.name }))
          )
        }
      } catch (stripeError) {
        if (isAmbiguousStripeOutcome(stripeError)) {
          await logError(
            logger,
            stripeError,
            'Stripe outcome unknown after DB commit (connection failure) - verify subscription in Stripe dashboard',
            {
              familyReferenceId,
              profileIds,
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              intendedAmount: newRate,
            }
          )
          throw new ActionError(
            'Withdrawal was recorded, but the Stripe billing update may not have completed. Verify the subscription in the Stripe dashboard before retrying.',
            ERROR_CODES.STRIPE_ERROR
          )
        }

        await logError(
          logger,
          stripeError,
          'Stripe call failed after DB commit, rolling back withdrawal',
          { familyReferenceId, profileIds }
        )

        let rollbackSucceeded = false
        try {
          await prisma.$transaction(async (tx) => {
            for (const { id, status } of originalStatuses) {
              await updateProgramProfileStatus(id, status, tx)
            }

            await reactivateBillingAssignmentsForProfiles(profileIds, now, tx)

            for (const { id, amount } of assignmentRollbacks) {
              await updateBillingAssignmentAmount(id, amount, tx)
            }

            for (const state of withdrawnEnrollments) {
              await restoreEnrollmentState(state.id, state, tx)
            }

            await reactivateClassEnrollmentsForProfiles(profileIds, now, tx)
          })
          rollbackSucceeded = true

          await logInfo(
            logger,
            'Successfully rolled back withdrawal after Stripe failure',
            { familyReferenceId, profileIds }
          )
        } catch (rollbackError) {
          await logError(
            logger,
            rollbackError,
            'Failed to rollback withdrawal after Stripe failure - MANUAL INTERVENTION REQUIRED',
            { familyReferenceId, profileIds }
          )
        }

        throw new ActionError(
          rollbackSucceeded
            ? 'Stripe billing update failed. Withdrawal has been rolled back.'
            : 'Stripe billing update failed and automatic rollback also failed. Billing needs manual review — check logs.',
          ERROR_CODES.STRIPE_ERROR
        )
      }

      // Full withdrawal only sets cancel_at_period_end: Stripe still bills the
      // remaining period at the current rate, so writing newRate (0) here would
      // claim the family owes nothing while their card is charged. The row is
      // retired by customer.subscription.deleted at period end. Partial
      // withdrawals really did reprice in Stripe, so they sync immediately.
      try {
        if (!allWithdrawn) {
          await updateSubscriptionAmount(subscription.id, newRate)
        }
      } catch (dbError) {
        // Only reachable on the partial path: the full-withdrawal branch
        // writes nothing, so there is no DB state to diverge from Stripe.
        const error = await handleBillingDivergence(
          logger,
          dbError,
          `Stripe updated to ${newRate} cents`,
          {
            familyReferenceId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            intendedAmount: newRate,
          }
        )
        return {
          success: false,
          error,
          warning,
          withdrawnCount: withdrawCount,
          remainingCount,
          newRate,
          previousRate,
          subscriptionCanceled: allWithdrawn,
        }
      }

      await logInfo(
        logger,
        allWithdrawn
          ? 'Subscription set to cancel at period end'
          : 'Subscription rate updated after withdrawal',
        {
          familyReferenceId,
          subscriptionId: subscription.stripeSubscriptionId,
          previousRate,
          newRate,
        }
      )

      return {
        success: true,
        warning,
        withdrawnCount: withdrawCount,
        remainingCount,
        newRate,
        previousRate,
        subscriptionCanceled: allWithdrawn,
      }
    }
  )
}
