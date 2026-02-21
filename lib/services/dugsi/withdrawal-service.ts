import { StripeAccountType } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { getDugsiKeys } from '@/lib/keys/stripe'
import { createServiceLogger, logError, logInfo } from '@/lib/logger'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'
import type {
  WithdrawChildInput,
  WithdrawFamilyInput,
  ReEnrollChildInput,
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

export interface ReEnrollResult {
  reEnrolled: boolean
  billingUpdated: boolean
  billingError?: string
}

export interface WithdrawFamilyResult {
  withdrawnCount: number
  billingCanceled: boolean
  billingError?: string
}

// ============================================================================
// WITHDRAW CHILD
// ============================================================================

export async function withdrawChild(
  input: WithdrawChildInput
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

      const billingResult = await applyBillingAdjustment({
        familyReferenceId: profile.familyReferenceId,
        billingAdjustmentType: billingAdjustment.type,
        subscription: preTransactionSubscription
          ? {
              id: preTransactionSubscription.id,
              stripeSubscriptionId:
                preTransactionSubscription.stripeSubscriptionId,
            }
          : null,
      })

      return {
        withdrawn: true,
        billingUpdated: billingResult.updated,
        billingError: billingResult.error,
      }
    }
  )
}

// ============================================================================
// WITHDRAW FAMILY (BATCH)
// ============================================================================

export interface WithdrawFamilyPreviewResult {
  count: number
  students: Array<{ id: string; name: string }>
}

export async function getWithdrawFamilyPreview(
  familyReferenceId: string
): Promise<WithdrawFamilyPreviewResult> {
  const activeProfiles = await prisma.programProfile.findMany({
    where: {
      familyReferenceId,
      program: DUGSI_PROGRAM,
      status: { in: ['REGISTERED', 'ENROLLED'] },
    },
    include: { person: { select: { name: true } } },
  })

  return {
    count: activeProfiles.length,
    students: activeProfiles.map((p) => ({ id: p.id, name: p.person.name })),
  }
}

export async function withdrawFamily(
  input: WithdrawFamilyInput
): Promise<WithdrawFamilyResult> {
  return Sentry.startSpan(
    { name: 'withdrawal.withdrawFamily', op: 'function' },
    async () => {
      const { familyReferenceId, reason, reasonNote } = input
      const reasonLabel = buildReasonString(reason, reasonNote)

      const subscription = await findFamilySubscription(familyReferenceId)

      const withdrawnCount = await prisma.$transaction(async (tx) => {
        const activeProfiles = await tx.programProfile.findMany({
          where: {
            familyReferenceId,
            program: DUGSI_PROGRAM,
            status: { in: ['REGISTERED', 'ENROLLED'] },
          },
          include: {
            person: true,
            enrollments: {
              where: { status: { in: ['REGISTERED', 'ENROLLED'] } },
              take: 1,
            },
            dugsiClassEnrollment: { where: { isActive: true } },
          },
        })

        if (activeProfiles.length === 0) {
          throw new ActionError(
            'No active children to withdraw',
            ERROR_CODES.INVALID_INPUT
          )
        }

        for (const profile of activeProfiles) {
          await tx.programProfile.update({
            where: { id: profile.id },
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

          if (profile.dugsiClassEnrollment) {
            await tx.dugsiClassEnrollment.update({
              where: { id: profile.dugsiClassEnrollment.id },
              data: { isActive: false, endDate: new Date() },
            })
          }
        }

        await tx.billingAssignment.updateMany({
          where: {
            isActive: true,
            programProfile: {
              familyReferenceId,
              program: DUGSI_PROGRAM,
            },
          },
          data: { isActive: false, endDate: new Date() },
        })

        return activeProfiles.length
      })

      await logInfo(logger, 'Family withdrawn from Dugsi', {
        familyReferenceId,
        withdrawnCount,
        reason,
      })

      let billingCanceled = false
      let billingError: string | undefined

      if (subscription) {
        try {
          const result = await cancelAndDeactivateSubscription(
            {
              id: subscription.id,
              stripeSubscriptionId: subscription.stripeSubscriptionId,
            },
            'withdraw_family'
          )
          billingCanceled = result.updated
        } catch (error) {
          billingError =
            error instanceof Error ? error.message : 'Unknown Stripe error'
          await logError(
            logger,
            error,
            'Billing cancellation failed after family withdrawal',
            { familyReferenceId }
          )
        }
      }

      return { withdrawnCount, billingCanceled, billingError }
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
      const { studentId } = input

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

      if (!familySubscription) {
        return {
          reEnrolled: true,
          billingUpdated: false,
          billingError: 'No active subscription to update',
        }
      }

      const billingResult = await applyBillingAdjustment({
        familyReferenceId: profile.familyReferenceId,
        billingAdjustmentType: 'auto_recalculate',
        subscription: {
          id: familySubscription.id,
          stripeSubscriptionId: familySubscription.stripeSubscriptionId,
        },
      })

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
  return Sentry.startSpan(
    { name: 'withdrawal.getWithdrawPreview', op: 'function' },
    async () => {
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

      const subscription = await findFamilySubscription(
        profile.familyReferenceId
      )

      return {
        childName: profile.person.name,
        activeChildrenCount: activeCount,
        currentAmount: subscription?.amount ?? null,
        recalculatedAmount: calculateDugsiRate(afterWithdrawalCount),
        isLastActiveChild: afterWithdrawalCount === 0,
        hasActiveSubscription:
          !!subscription &&
          (subscription.status === 'active' ||
            subscription.status === 'paused'),
        isPaused: subscription?.status === 'paused',
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

async function cancelAndDeactivateSubscription(
  subscription: { id: string; stripeSubscriptionId: string },
  operation: string
): Promise<{ updated: boolean; error?: string }> {
  const stripe = getDugsiStripeClient()
  await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)

  try {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'canceled' },
      }),
      prisma.billingAssignment.updateMany({
        where: { subscriptionId: subscription.id, isActive: true },
        data: { isActive: false, endDate: new Date() },
      }),
    ])
  } catch (dbError) {
    await logError(
      logger,
      dbError,
      'CRITICAL: Stripe subscription canceled but DB update failed - states diverged',
      { stripeSubscriptionId: subscription.stripeSubscriptionId, operation }
    )
    return {
      updated: false,
      error: `Stripe canceled but DB update failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`,
    }
  }
  return { updated: true }
}

async function applyBillingAdjustment(params: {
  familyReferenceId: string | null
  billingAdjustmentType: 'auto_recalculate' | 'cancel_subscription'
  subscription: { id: string; stripeSubscriptionId: string } | null
}): Promise<{ updated: boolean; error?: string }> {
  const { familyReferenceId, billingAdjustmentType, subscription } = params

  if (!subscription) {
    if (billingAdjustmentType === 'cancel_subscription') {
      return { updated: false, error: 'No active subscription to cancel' }
    }
    return { updated: true }
  }

  try {
    if (billingAdjustmentType === 'cancel_subscription') {
      return await cancelAndDeactivateSubscription(
        subscription,
        'cancel_subscription'
      )
    }

    const activeCount = await prisma.programProfile.count({
      where: {
        program: DUGSI_PROGRAM,
        familyReferenceId,
        status: { in: ['REGISTERED', 'ENROLLED'] },
      },
    })
    const newAmount = calculateDugsiRate(activeCount)

    if (newAmount <= 0) {
      return await cancelAndDeactivateSubscription(
        subscription,
        'auto_recalculate_cancel'
      )
    }

    const { productId } = getDugsiKeys()
    if (!productId) {
      return { updated: false, error: 'Stripe product ID not configured' }
    }

    const stripe = getDugsiStripeClient()
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
      return {
        updated: false,
        error: `Stripe updated to ${newAmount} but DB failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`,
      }
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
