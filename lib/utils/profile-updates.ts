/**
 * Profile Update Utilities
 *
 * Centralized utilities for updating ProgramProfile and Enrollment subscription data.
 * Handles status tracking, subscription history, and period date updates.
 */

import type { Prisma } from '@prisma/client'
import { EnrollmentStatus, SubscriptionStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  createBillingAssignment,
  updateBillingAssignmentStatus,
  getBillingAssignmentsByProfile,
  updateSubscriptionStatus,
  addSubscriptionHistory,
} from '@/lib/db/queries/billing'
import {
  updateEnrollmentStatus,
  getActiveEnrollment,
} from '@/lib/db/queries/enrollment'

/**
 * Configuration for building profile update data
 */
interface ProfileUpdateConfig {
  subscriptionId: string
  customerId?: string
  subscriptionStatus: SubscriptionStatus
  newProfileStatus: EnrollmentStatus
  periodStart: Date | null
  periodEnd: Date | null
  amount?: number
  program: 'MAHAD' | 'DUGSI'
}

/**
 * Profile data required for update
 */
interface ProfileForUpdate {
  id: string
  status: EnrollmentStatus
}

/**
 * Update multiple profiles with subscription data within a transaction.
 * Creates/updates BillingAssignment records and updates Enrollment status.
 *
 * @example
 * ```typescript
 * await prisma.$transaction(async (tx) => {
 *   const profiles = await tx.programProfile.findMany({ where: { ... } })
 *   const updatePromises = updateProfilesInTransaction(profiles, config, tx)
 *   await Promise.all(updatePromises)
 * })
 * ```
 */
export async function updateProfilesInTransaction<T extends ProfileForUpdate>(
  profiles: T[],
  config: ProfileUpdateConfig,
  transactionClient: Prisma.TransactionClient
) {
  const {
    subscriptionId,
    subscriptionStatus,
    newProfileStatus,
    periodStart,
    periodEnd,
    amount,
  } = config

  // Get subscription record
  const subscription = await transactionClient.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  })

  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`)
  }

  const updatePromises = profiles.map(async (profile) => {
    // Update ProgramProfile status
    await transactionClient.programProfile.update({
      where: { id: profile.id },
      data: {
        status: newProfileStatus,
      },
    })

    // Get active enrollment
    const activeEnrollment = await getActiveEnrollment(profile.id)

    if (activeEnrollment) {
      // Update enrollment status if it changed
      if (activeEnrollment.status !== newProfileStatus) {
        await updateEnrollmentStatus(
          activeEnrollment.id,
          newProfileStatus,
          null,
          newProfileStatus === 'WITHDRAWN' ? new Date() : null
        )
      }
    }

    // Check if billing assignment already exists
    const existingAssignments = await getBillingAssignmentsByProfile(profile.id)
    const existingAssignment = existingAssignments.find(
      (a) => a.subscriptionId === subscription.id && a.isActive
    )

    if (existingAssignment) {
      // Update existing assignment
      await updateBillingAssignmentStatus(existingAssignment.id, true)
    } else {
      // Create new billing assignment
      const assignmentAmount = amount || subscription.amount
      await createBillingAssignment({
        subscriptionId: subscription.id,
        programProfileId: profile.id,
        amount: assignmentAmount,
        percentage:
          profiles.length > 1
            ? (assignmentAmount / subscription.amount) * 100
            : null,
      })
    }

    // Update subscription status and period dates
    await updateSubscriptionStatus(subscription.id, subscriptionStatus, {
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      paidUntil: periodEnd,
    })

    return profile
  })

  return Promise.all(updatePromises)
}

/**
 * Build cancellation update data for a profile.
 * Used when a subscription is deleted.
 */
export function buildCancellationUpdateData(
  subscriptionId: string,
  program: 'MAHAD' | 'DUGSI'
) {
  return {
    subscriptionId,
    program,
    status: 'WITHDRAWN' as EnrollmentStatus,
  }
}

/**
 * Sync subscription state for profiles linked to a subscription.
 * Updates ProgramProfile status, Enrollment status, and BillingAssignment records.
 */
export async function syncProfileSubscriptionState(
  subscriptionId: string,
  subscriptionStatus: SubscriptionStatus,
  periodStart: Date | null,
  periodEnd: Date | null
) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      assignments: {
        where: { isActive: true },
        include: {
          programProfile: {
            include: {
              enrollments: {
                where: {
                  status: { not: 'WITHDRAWN' },
                  endDate: null,
                },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`)
  }

  // Map subscription status to enrollment status
  const enrollmentStatusMap: Record<SubscriptionStatus, EnrollmentStatus> = {
    active: 'ENROLLED',
    trialing: 'REGISTERED',
    past_due: 'ENROLLED',
    canceled: 'WITHDRAWN',
    unpaid: 'WITHDRAWN',
    incomplete: 'REGISTERED',
    incomplete_expired: 'WITHDRAWN',
    paused: 'ON_LEAVE',
  }

  const newStatus = enrollmentStatusMap[subscriptionStatus] || 'REGISTERED'

  // Update each profile linked to this subscription
  for (const assignment of subscription.assignments) {
    const profile = assignment.programProfile

    // Update ProgramProfile status
    await prisma.programProfile.update({
      where: { id: profile.id },
      data: { status: newStatus },
    })

    // Update Enrollment status if exists
    if (profile.enrollments.length > 0) {
      const enrollment = profile.enrollments[0]
      await updateEnrollmentStatus(
        enrollment.id,
        newStatus,
        null,
        newStatus === 'WITHDRAWN' ? new Date() : null
      )
    }

    // Update subscription period dates
    await updateSubscriptionStatus(subscription.id, subscriptionStatus, {
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      paidUntil: periodEnd,
    })
  }

  // Add subscription history entry
  await addSubscriptionHistory({
    subscriptionId: subscription.id,
    eventType: 'subscription.updated',
    eventId: subscriptionId,
    status: subscriptionStatus,
    amount: subscription.amount,
  })
}

/**
 * @deprecated Use `updateProfilesInTransaction` instead.
 * This alias exists for backward compatibility and will be removed in a future release.
 */
export const updateStudentsInTransaction = updateProfilesInTransaction

/**
 * @deprecated Use `buildCancellationUpdateData` instead.
 * This alias exists for backward compatibility and will be removed in a future release.
 */
export const buildStudentUpdateData = buildCancellationUpdateData
