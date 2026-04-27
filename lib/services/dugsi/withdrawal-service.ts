import * as Sentry from '@sentry/nextjs'

import { EnrollmentStatus } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { getDugsiKeys } from '@/lib/keys/stripe'
import {
  createServiceLogger,
  logError,
  logInfo,
  logWarning,
} from '@/lib/logger'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import {
  calculateDugsiRate,
  getStripeInterval,
} from '@/lib/utils/dugsi-tuition'

import {
  findFamilySubscription,
  handleBillingDivergence,
} from './billing-helpers'

const logger = createServiceLogger('dugsi-withdrawal')

const WITHDRAWABLE_STATUSES: EnrollmentStatus[] = ['REGISTERED', 'ENROLLED']

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

export async function withdrawChildren(
  familyReferenceId: string,
  profileIds: string[]
): Promise<WithdrawChildrenResult> {
  return Sentry.startSpan(
    { name: 'withdrawal.withdrawChildren', op: 'function' },
    async () => {
      const allFamilyProfiles = await prisma.programProfile.findMany({
        where: {
          familyReferenceId,
          program: DUGSI_PROGRAM,
          status: { in: WITHDRAWABLE_STATUSES },
        },
        include: {
          person: { select: { name: true } },
          assignments: {
            where: { isActive: true },
            include: { subscription: true },
          },
        },
      })

      if (allFamilyProfiles.length === 0) {
        throw new ActionError(
          'No active children found for this family',
          ERROR_CODES.FAMILY_NOT_FOUND
        )
      }

      const profilesToWithdraw = allFamilyProfiles.filter((p) =>
        profileIds.includes(p.id)
      )

      if (profilesToWithdraw.length !== profileIds.length) {
        const foundIds = new Set(profilesToWithdraw.map((p) => p.id))
        const missing = profileIds.filter((id) => !foundIds.has(id))
        throw new ActionError(
          `Some children not found or not eligible for withdrawal: ${missing.join(', ')}`,
          ERROR_CODES.INVALID_INPUT
        )
      }

      const currentActiveCount = allFamilyProfiles.length
      const withdrawCount = profilesToWithdraw.length
      const remainingCount = currentActiveCount - withdrawCount
      const allWithdrawn = remainingCount === 0

      const newRate = calculateDugsiRate(remainingCount)

      const subscription = await findFamilySubscription(familyReferenceId)
      const previousRate =
        subscription?.amount ?? calculateDugsiRate(currentActiveCount)
      const isPaused = subscription?.status === 'paused'

      const originalStatuses = profilesToWithdraw.map((p) => ({
        id: p.id,
        status: p.status as EnrollmentStatus,
      }))

      const now = new Date()

      await prisma.$transaction(async (tx) => {
        await tx.programProfile.updateMany({
          where: { id: { in: profileIds } },
          data: { status: 'WITHDRAWN' },
        })

        await tx.billingAssignment.updateMany({
          where: {
            programProfileId: { in: profileIds },
            isActive: true,
          },
          data: {
            isActive: false,
            endDate: now,
          },
        })
      })

      const childNames = profilesToWithdraw.map((p) => p.person.name).join(', ')

      await logInfo(logger, 'Children withdrawn from Dugsi', {
        familyReferenceId,
        withdrawnChildren: childNames,
        withdrawCount,
        remainingCount,
        previousRate,
        newRate,
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

      if (isPaused) {
        try {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { amount: allWithdrawn ? 0 : newRate },
          })
        } catch (dbError) {
          await logError(
            logger,
            dbError,
            'Failed to update paused subscription amount in DB after withdrawal',
            { familyReferenceId, subscriptionId: subscription.id }
          )
        }

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

      try {
        if (allWithdrawn) {
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
          })

          try {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { amount: 0 },
            })
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
        })

        try {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { amount: newRate },
          })
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
              await tx.programProfile.updateMany({
                where: { id },
                data: { status },
              })
            }

            await tx.billingAssignment.updateMany({
              where: {
                programProfileId: { in: profileIds },
                isActive: false,
                endDate: now,
              },
              data: {
                isActive: true,
                endDate: null,
              },
            })
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
