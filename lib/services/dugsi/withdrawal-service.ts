import { type Subscription, StripeAccountType } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'

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
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'
import type {
  WithdrawChildInput,
  ReEnrollChildInput,
  WithdrawAllChildrenInput,
} from '@/lib/validations/dugsi'

const logger = createServiceLogger('dugsi-withdrawal')

// ============================================================================
// TYPES
// ============================================================================

export interface WithdrawPreview {
  childName: string
  activeChildrenCount: number
  currentAmount: number | null
  recalculatedAmount: number
  isLastActiveChild: boolean
  hasActiveSubscription: boolean
  isPaused: boolean
}

export interface WithdrawResult {
  withdrawn: boolean
  billingUpdated: boolean
  billingError?: string
}

export interface WithdrawAllResult {
  withdrawnCount: number
  failedCount: number
  billingUpdated: boolean
  billingError?: string
}

export interface ReEnrollResult {
  reEnrolled: boolean
  billingUpdated: boolean
  billingError?: string
}

// ============================================================================
// WITHDRAW CHILD
// ============================================================================

export async function withdrawChild(
  input: WithdrawChildInput,
  options?: { skipLastChildGuard?: boolean }
): Promise<WithdrawResult> {
  return Sentry.startSpan(
    { name: 'withdrawal.withdrawChild', op: 'function' },
    async () => {
      const { studentId, reason, reasonNote, billingAdjustment } = input

      const profile = await prisma.programProfile.findUnique({
        where: { id: studentId },
        include: {
          person: true,
          enrollments: {
            where: { status: { in: ['REGISTERED', 'ENROLLED'] } },
            take: 1,
          },
          assignments: {
            where: { isActive: true },
            include: { subscription: true },
          },
          dugsiClassEnrollment: { where: { isActive: true } },
        },
      })

      if (!profile || profile.program !== DUGSI_PROGRAM) {
        throw new ActionError(
          'Student not found',
          ERROR_CODES.STUDENT_NOT_FOUND,
          undefined,
          404
        )
      }

      if (profile.status === 'WITHDRAWN') {
        throw new ActionError(
          'Student is already withdrawn',
          ERROR_CODES.ALREADY_WITHDRAWN
        )
      }

      if (
        !options?.skipLastChildGuard &&
        (billingAdjustment.type === 'keep_current' ||
          billingAdjustment.type === 'custom')
      ) {
        const activeCount = await prisma.programProfile.count({
          where: {
            program: DUGSI_PROGRAM,
            familyReferenceId: profile.familyReferenceId,
            status: { in: ['REGISTERED', 'ENROLLED'] },
          },
        })
        if (activeCount <= 1) {
          throw new ActionError(
            `Cannot use "${billingAdjustment.type}" when withdrawing the last active child`,
            ERROR_CODES.INVALID_INPUT
          )
        }
      }

      const reasonLabel = buildReasonString(reason, reasonNote)
      const preTransactionSubscription =
        profile.assignments[0]?.subscription ?? null

      await prisma.$transaction(async (tx) => {
        await tx.programProfile.update({
          where: { id: studentId },
          data: { status: 'WITHDRAWN' },
        })

        if (profile.enrollments[0]) {
          await tx.enrollment.update({
            where: { id: profile.enrollments[0].id },
            data: {
              status: 'WITHDRAWN',
              endDate: new Date(),
              reason: reasonLabel,
            },
          })
        }

        for (const assignment of profile.assignments) {
          await tx.billingAssignment.update({
            where: { id: assignment.id },
            data: { isActive: false, endDate: new Date() },
          })
        }

        if (profile.dugsiClassEnrollment) {
          await tx.dugsiClassEnrollment.update({
            where: { id: profile.dugsiClassEnrollment.id },
            data: { isActive: false, endDate: new Date() },
          })
        }
      })

      await logInfo(logger, 'Child withdrawn from Dugsi', {
        studentId,
        childName: profile.person.name,
        reason,
      })

      const billingResult = await applyBillingAdjustment(
        studentId,
        billingAdjustment,
        preTransactionSubscription
      )

      return {
        withdrawn: true,
        billingUpdated: billingResult.updated,
        billingError: billingResult.error,
      }
    }
  )
}

// ============================================================================
// RE-ENROLL CHILD
// ============================================================================

export async function reEnrollChild(
  input: ReEnrollChildInput
): Promise<ReEnrollResult> {
  return Sentry.startSpan(
    { name: 'withdrawal.reEnrollChild', op: 'function' },
    async () => {
      const { studentId, billingAdjustment } = input

      const profile = await prisma.programProfile.findUnique({
        where: { id: studentId },
        include: {
          person: true,
          assignments: {
            where: { isActive: true },
            include: { subscription: true },
          },
        },
      })

      if (!profile || profile.program !== DUGSI_PROGRAM) {
        throw new ActionError(
          'Student not found',
          ERROR_CODES.STUDENT_NOT_FOUND,
          undefined,
          404
        )
      }

      if (profile.status !== 'WITHDRAWN') {
        throw new ActionError(
          'Student is not withdrawn',
          ERROR_CODES.NOT_WITHDRAWN
        )
      }

      const familySubscription = await findFamilySubscription(
        profile.familyReferenceId
      )

      await prisma.$transaction(async (tx) => {
        const activeCount = await tx.programProfile.count({
          where: {
            program: DUGSI_PROGRAM,
            familyReferenceId: profile.familyReferenceId,
            status: { in: ['REGISTERED', 'ENROLLED'] },
          },
        })
        const initialAmount = calculateDugsiRate(activeCount + 1)

        await tx.programProfile.update({
          where: { id: studentId },
          data: { status: 'ENROLLED' },
        })

        await tx.enrollment.create({
          data: {
            programProfileId: studentId,
            status: 'ENROLLED',
            startDate: new Date(),
          },
        })

        if (familySubscription) {
          if (initialAmount <= 0) {
            throw new ActionError(
              'Calculated billing amount is invalid',
              ERROR_CODES.INVALID_INPUT
            )
          }
          await tx.billingAssignment.create({
            data: {
              subscriptionId: familySubscription.id,
              programProfileId: studentId,
              amount: initialAmount,
              isActive: true,
            },
          })
        }
      })

      await logInfo(logger, 'Child re-enrolled in Dugsi', {
        studentId,
        childName: profile.person.name,
      })

      const billingResult = await applyBillingAdjustment(
        studentId,
        billingAdjustment
      )

      return {
        reEnrolled: true,
        billingUpdated: billingResult.updated,
        billingError: billingResult.error,
      }
    }
  )
}

// ============================================================================
// WITHDRAW PREVIEW
// ============================================================================

export async function getWithdrawPreview(
  studentId: string
): Promise<WithdrawPreview> {
  const profile = await prisma.programProfile.findUnique({
    where: { id: studentId },
    include: { person: true },
  })

  if (!profile || profile.program !== DUGSI_PROGRAM) {
    throw new ActionError(
      'Student not found',
      ERROR_CODES.STUDENT_NOT_FOUND,
      undefined,
      404
    )
  }

  const activeCount = await prisma.programProfile.count({
    where: {
      program: DUGSI_PROGRAM,
      familyReferenceId: profile.familyReferenceId,
      status: { in: ['REGISTERED', 'ENROLLED'] },
    },
  })
  const afterWithdrawalCount = activeCount - 1

  const subscription = await findFamilySubscription(profile.familyReferenceId)

  return {
    childName: profile.person.name,
    activeChildrenCount: activeCount,
    currentAmount: subscription?.amount ?? null,
    recalculatedAmount: calculateDugsiRate(afterWithdrawalCount),
    isLastActiveChild: afterWithdrawalCount === 0,
    hasActiveSubscription:
      !!subscription &&
      (subscription.status === 'active' || subscription.status === 'paused'),
    isPaused: subscription?.status === 'paused',
  }
}

// ============================================================================
// WITHDRAW ALL CHILDREN
// ============================================================================

export async function withdrawAllChildren(
  input: WithdrawAllChildrenInput
): Promise<WithdrawAllResult> {
  return Sentry.startSpan(
    { name: 'withdrawal.withdrawAllChildren', op: 'function' },
    async () => {
      const { studentId, reason, reasonNote, billingAdjustment } = input

      const profile = await prisma.programProfile.findUnique({
        where: { id: studentId },
        select: { familyReferenceId: true },
      })

      if (!profile?.familyReferenceId) {
        throw new ActionError(
          'Family not found',
          ERROR_CODES.STUDENT_NOT_FOUND,
          undefined,
          404
        )
      }

      const activeProfiles = await prisma.programProfile.findMany({
        where: {
          program: DUGSI_PROGRAM,
          familyReferenceId: profile.familyReferenceId,
          status: { in: ['REGISTERED', 'ENROLLED'] },
        },
        select: { id: true },
      })

      if (activeProfiles.length === 0) {
        throw new ActionError(
          'No active children to withdraw',
          ERROR_CODES.ALREADY_WITHDRAWN
        )
      }

      const preWithdrawalSubscription = await findFamilySubscription(
        profile.familyReferenceId
      )

      let withdrawnCount = 0
      let failedCount = 0

      for (const activeProfile of activeProfiles) {
        try {
          await withdrawChild(
            {
              studentId: activeProfile.id,
              reason,
              reasonNote,
              billingAdjustment: { type: 'keep_current' },
            },
            { skipLastChildGuard: true }
          )
          withdrawnCount++
        } catch (error) {
          failedCount++
          if (error instanceof ActionError) {
            await logWarning(logger, 'Expected failure in bulk withdrawal', {
              studentId: activeProfile.id,
              error: error.message,
            })
          } else {
            await logError(
              logger,
              error,
              'Unexpected failure in bulk withdrawal',
              { studentId: activeProfile.id }
            )
          }
        }
      }

      let effectiveBilling = billingAdjustment
      if (failedCount > 0 && billingAdjustment.type === 'cancel_subscription') {
        effectiveBilling = { type: 'auto_recalculate' }
        await logWarning(
          logger,
          'Downgraded cancel_subscription to auto_recalculate due to partial failure',
          {
            familyReferenceId: profile.familyReferenceId,
            withdrawnCount,
            failedCount,
          }
        )
      }

      const billingResult = await applyBillingAdjustment(
        studentId,
        effectiveBilling,
        preWithdrawalSubscription
      )

      await logInfo(logger, 'Bulk withdrawal completed', {
        familyReferenceId: profile.familyReferenceId,
        withdrawnCount,
        failedCount,
      })

      return {
        withdrawnCount,
        failedCount,
        billingUpdated: billingResult.updated,
        billingError:
          billingResult.error ??
          (failedCount > 0
            ? `${failedCount} child(ren) could not be withdrawn`
            : undefined),
      }
    }
  )
}

// ============================================================================
// PAUSE / RESUME BILLING
// ============================================================================

export async function pauseFamilyBilling(
  familyReferenceId: string
): Promise<void> {
  return Sentry.startSpan(
    { name: 'withdrawal.pauseFamilyBilling', op: 'function' },
    async () => {
      const subscription = await findFamilySubscription(familyReferenceId)

      if (!subscription) {
        throw new ActionError(
          'No active subscription found for this family',
          ERROR_CODES.NO_ACTIVE_SUBSCRIPTION
        )
      }

      if (subscription.status !== 'active') {
        throw new ActionError(
          `Cannot pause subscription with status "${subscription.status}"`,
          ERROR_CODES.INVALID_INPUT
        )
      }

      const stripe = getDugsiStripeClient()

      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        pause_collection: { behavior: 'void' },
      })

      try {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'paused' },
        })
      } catch (dbError) {
        await logError(
          logger,
          dbError,
          'CRITICAL: Stripe paused but DB update failed - states diverged',
          {
            familyReferenceId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            intendedStatus: 'paused',
          }
        )
        throw dbError
      }

      await logInfo(logger, 'Family billing paused', {
        familyReferenceId,
        subscriptionId: subscription.stripeSubscriptionId,
      })
    }
  )
}

export async function resumeFamilyBilling(
  familyReferenceId: string
): Promise<void> {
  return Sentry.startSpan(
    { name: 'withdrawal.resumeFamilyBilling', op: 'function' },
    async () => {
      const subscription = await findFamilySubscription(familyReferenceId)

      if (!subscription) {
        throw new ActionError(
          'No subscription found for this family',
          ERROR_CODES.NO_ACTIVE_SUBSCRIPTION
        )
      }

      if (subscription.status !== 'paused') {
        throw new ActionError(
          `Cannot resume subscription with status "${subscription.status}"`,
          ERROR_CODES.INVALID_INPUT
        )
      }

      const stripe = getDugsiStripeClient()

      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        pause_collection: null,
      })

      try {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'active' },
        })
      } catch (dbError) {
        await logError(
          logger,
          dbError,
          'CRITICAL: Stripe resumed but DB update failed - states diverged',
          {
            familyReferenceId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            intendedStatus: 'active',
          }
        )
        throw dbError
      }

      await logInfo(logger, 'Family billing resumed', {
        familyReferenceId,
        subscriptionId: subscription.stripeSubscriptionId,
      })
    }
  )
}

// ============================================================================
// HELPERS
// ============================================================================

async function findFamilySubscription(familyReferenceId: string | null) {
  if (!familyReferenceId) return null

  const assignment = await prisma.billingAssignment.findFirst({
    where: {
      isActive: true,
      programProfile: {
        familyReferenceId,
        program: DUGSI_PROGRAM,
      },
      subscription: {
        stripeAccountType: StripeAccountType.DUGSI,
        status: { in: ['active', 'paused'] },
      },
    },
    include: { subscription: true },
    orderBy: { createdAt: 'desc' },
  })

  return assignment?.subscription ?? null
}

async function applyBillingAdjustment(
  studentId: string,
  billingAdjustment:
    | WithdrawChildInput['billingAdjustment']
    | ReEnrollChildInput['billingAdjustment'],
  fallbackSubscription?: Pick<
    Subscription,
    'id' | 'stripeSubscriptionId' | 'status' | 'amount'
  > | null
): Promise<{ updated: boolean; error?: string }> {
  const profile = await prisma.programProfile.findUnique({
    where: { id: studentId },
    select: { familyReferenceId: true },
  })

  const queriedSubscription = await findFamilySubscription(
    profile?.familyReferenceId ?? null
  )
  const subscription = queriedSubscription ?? fallbackSubscription ?? null

  if (!queriedSubscription && fallbackSubscription) {
    await logWarning(logger, 'Using pre-transaction subscription fallback', {
      studentId,
      subscriptionId: fallbackSubscription.stripeSubscriptionId,
    })
  }

  if (!subscription) {
    if (billingAdjustment.type === 'cancel_subscription') {
      return { updated: false, error: 'No active subscription to cancel' }
    }
    return { updated: true }
  }

  try {
    const stripe = getDugsiStripeClient()

    if (billingAdjustment.type === 'keep_current') {
      return { updated: true }
    }

    if (billingAdjustment.type === 'cancel_subscription') {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
      try {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'canceled' },
        })
        await prisma.billingAssignment.updateMany({
          where: { subscriptionId: subscription.id, isActive: true },
          data: { isActive: false, endDate: new Date() },
        })
      } catch (dbError) {
        await logError(
          logger,
          dbError,
          'CRITICAL: Stripe subscription canceled but DB update failed - states diverged',
          {
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            operation: 'cancel_subscription',
          }
        )
        throw dbError
      }
      return { updated: true }
    }

    let newAmount: number
    if (billingAdjustment.type === 'custom') {
      newAmount = billingAdjustment.amount
    } else {
      const activeCount = await prisma.programProfile.count({
        where: {
          program: DUGSI_PROGRAM,
          familyReferenceId: profile?.familyReferenceId,
          status: { in: ['REGISTERED', 'ENROLLED'] },
        },
      })
      newAmount = calculateDugsiRate(activeCount)
    }

    if (newAmount <= 0) {
      if (billingAdjustment.type === 'auto_recalculate') {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
        try {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'canceled' },
          })
          await prisma.billingAssignment.updateMany({
            where: { subscriptionId: subscription.id, isActive: true },
            data: { isActive: false, endDate: new Date() },
          })
        } catch (dbError) {
          await logError(
            logger,
            dbError,
            'CRITICAL: Stripe subscription canceled but DB update failed - states diverged',
            {
              stripeSubscriptionId: subscription.stripeSubscriptionId,
              operation: 'auto_recalculate_cancel',
            }
          )
          throw dbError
        }
        return { updated: true }
      }
      return { updated: false, error: 'Calculated amount is zero or negative' }
    }

    const { productId } = getDugsiKeys()
    if (!productId) {
      return { updated: false, error: 'Stripe product ID not configured' }
    }

    const stripeSub = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    )
    const itemId = stripeSub.items.data[0]?.id
    if (!itemId) {
      return { updated: false, error: 'No subscription item found in Stripe' }
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [
        {
          id: itemId,
          price_data: {
            product: productId,
            unit_amount: newAmount,
            currency: 'usd',
            recurring: { interval: 'month' },
          },
        },
      ],
      proration_behavior: 'none',
    })

    try {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { amount: newAmount },
      })
    } catch (dbError) {
      await logError(
        logger,
        dbError,
        'CRITICAL: Stripe amount updated but DB update failed - states diverged',
        {
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          operation: 'amount_update',
          newAmount,
        }
      )
      throw dbError
    }

    await logInfo(logger, 'Stripe subscription amount updated', {
      subscriptionId: subscription.stripeSubscriptionId,
      newAmount,
    })

    return { updated: true }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown Stripe error'
    await logError(
      logger,
      error,
      'Billing adjustment failed after withdrawal',
      { subscriptionId: subscription.stripeSubscriptionId }
    )
    return { updated: false, error: message }
  }
}

function buildReasonString(
  reason: WithdrawChildInput['reason'],
  note?: string
): string {
  const labels: Record<WithdrawChildInput['reason'], string> = {
    family_moved: 'Family moved',
    financial: 'Financial reasons',
    behavioral: 'Behavioral',
    seasonal_break: 'Seasonal break',
    other: 'Other',
  }
  const label = labels[reason]
  return note ? `${label}: ${note}` : label
}
