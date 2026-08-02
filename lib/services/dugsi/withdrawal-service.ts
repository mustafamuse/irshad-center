import { EnrollmentStatus } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  deactivateBillingAssignmentsForProfiles,
  reactivateBillingAssignmentsForProfiles,
  updateSubscriptionAmount,
} from '@/lib/db/queries/billing'
import {
  deactivateClassEnrollmentsForProfiles,
  reactivateClassEnrollmentsForProfiles,
} from '@/lib/db/queries/dugsi-class'
import {
  getActiveEnrollment,
  restoreEnrollmentState,
  updateEnrollmentStatus,
} from '@/lib/db/queries/enrollment'
import {
  findFamilyProfilesForWithdrawal,
  updateProgramProfileStatus,
  updateProgramProfileStatusMany,
} from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { getDugsiKeys } from '@/lib/keys/stripe'
import {
  createServiceLogger,
  logError,
  logInfo,
  logWarning,
} from '@/lib/logger'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { isValidStatusTransition } from '@/lib/types/enrollment'
import {
  calculateDugsiRate,
  formatRateDisplay,
  getRateTierDescription,
  getStripeInterval,
} from '@/lib/utils/dugsi-tuition'

import {
  findFamilySubscription,
  handleBillingDivergence,
} from './billing-helpers'

const logger = createServiceLogger('dugsi-withdrawal')

const WITHDRAWABLE_STATUSES: EnrollmentStatus[] = ['REGISTERED', 'ENROLLED']

const WITHDRAWAL_REASON = 'Withdrawn by admin'

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
  profileIds: string[]
): Promise<WithdrawChildrenResult> {
  return Sentry.startSpan(
    { name: 'withdrawal.withdrawChildren', op: 'function' },
    async () => {
      const subscription = await findFamilySubscription(familyReferenceId)

      const now = new Date()

      // Profiles are read and counted inside the transaction so a concurrent
      // withdrawal of other children in the same family cannot produce a
      // stale remainingCount (and therefore a wrong Stripe rate).
      const { profilesToWithdraw, remainingProfiles, withdrawnEnrollments } =
        await prisma.$transaction(async (tx) => {
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

          const enrollmentStates: EnrollmentRollbackState[] = []
          for (const profileId of profileIds) {
            const activeEnrollment = await getActiveEnrollment(profileId, tx)
            if (
              activeEnrollment &&
              isValidStatusTransition(activeEnrollment.status, 'WITHDRAWN')
            ) {
              enrollmentStates.push({
                id: activeEnrollment.id,
                status: activeEnrollment.status,
                endDate: activeEnrollment.endDate,
                reason: activeEnrollment.reason,
              })
              await updateEnrollmentStatus(
                activeEnrollment.id,
                'WITHDRAWN',
                WITHDRAWAL_REASON,
                now,
                tx
              )
            }
          }

          await deactivateClassEnrollmentsForProfiles(profileIds, now, tx)

          return {
            profilesToWithdraw: toWithdraw,
            remainingProfiles: remaining,
            withdrawnEnrollments: enrollmentStates,
          }
        })

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

          try {
            await updateSubscriptionAmount(subscription.id, 0)
          } catch (dbError) {
            const error = await handleBillingDivergence(
              logger,
              dbError,
              'Stripe cancel_at_period_end set',
              {
                familyReferenceId,
                stripeSubscriptionId: subscription.stripeSubscriptionId,
              }
            )
            return {
              success: false,
              error,
              withdrawnCount: withdrawCount,
              remainingCount,
              newRate,
              previousRate,
              subscriptionCanceled: true,
            }
          }

          await logInfo(logger, 'Subscription set to cancel at period end', {
            familyReferenceId,
            subscriptionId: subscription.stripeSubscriptionId,
          })

          return {
            success: true,
            warning,
            withdrawnCount: withdrawCount,
            remainingCount,
            newRate: 0,
            previousRate,
            subscriptionCanceled: true,
          }
        }

        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId
        )
        const subscriptionItemId = stripeSubscription.items.data[0]?.id

        if (!subscriptionItemId) {
          throw new ActionError(
            'Subscription has no line items to update',
            ERROR_CODES.STRIPE_ERROR
          )
        }

        const { productId } = getDugsiKeys()
        if (!productId) {
          throw new ActionError(
            'Stripe product not configured for Dugsi',
            ERROR_CODES.STRIPE_ERROR
          )
        }
        const intervalConfig = getStripeInterval()

        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          items: [
            {
              id: subscriptionItemId,
              price_data: {
                product: productId,
                unit_amount: newRate,
                currency: 'usd',
                recurring: intervalConfig,
              },
            },
          ],
          proration_behavior: 'none',
          metadata: {
            Children: remainingProfiles.map((p) => p.name).join(', '),
            Rate: formatRateDisplay(newRate),
            Tier: getRateTierDescription(remainingCount),
            childCount: remainingCount.toString(),
            calculatedRate: newRate.toString(),
            profileIds: remainingProfiles.map((p) => p.id).join(','),
          },
        })

        try {
          await updateSubscriptionAmount(subscription.id, newRate)
        } catch (dbError) {
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
            subscriptionCanceled: false,
          }
        }

        await logInfo(logger, 'Subscription rate updated after withdrawal', {
          familyReferenceId,
          subscriptionId: subscription.stripeSubscriptionId,
          previousRate,
          newRate,
        })

        return {
          success: true,
          warning,
          withdrawnCount: withdrawCount,
          remainingCount,
          newRate,
          previousRate,
          subscriptionCanceled: false,
        }
      } catch (stripeError) {
        await logError(
          logger,
          stripeError,
          'Stripe call failed after DB commit, rolling back withdrawal',
          { familyReferenceId, profileIds }
        )

        try {
          await prisma.$transaction(async (tx) => {
            for (const { id, status } of originalStatuses) {
              await updateProgramProfileStatus(id, status, tx)
            }

            await reactivateBillingAssignmentsForProfiles(profileIds, now, tx)

            for (const state of withdrawnEnrollments) {
              await restoreEnrollmentState(state.id, state, tx)
            }

            await reactivateClassEnrollmentsForProfiles(profileIds, now, tx)
          })

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
          'Stripe billing update failed. Withdrawal has been rolled back.',
          ERROR_CODES.STRIPE_ERROR
        )
      }
    }
  )
}
