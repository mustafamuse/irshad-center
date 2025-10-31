/**
 * Student Update Utilities
 *
 * Centralized utilities for updating student subscription data.
 * Handles status tracking, subscription history, and period date updates.
 */

import type { Prisma } from '@prisma/client'

/**
 * Type-safe update data for Mahad student subscription updates
 */
type MahadStudentUpdateData = Prisma.StudentUpdateInput & {
  previousSubscriptionIds?: { push: string }
}

/**
 * Type-safe update data for Dugsi student subscription updates
 */
type DugsiStudentUpdateData = Prisma.StudentUpdateInput & {
  previousSubscriptionIdsDugsi?: { push: string }
}

/**
 * Configuration for building student update data
 */
interface StudentUpdateConfig {
  subscriptionId: string
  customerId?: string
  subscriptionStatus: string
  newStudentStatus: string
  periodStart: Date | null
  periodEnd: Date | null
  monthlyRate?: number
  program: 'MAHAD' | 'DUGSI'
}

/**
 * Student data required for update
 */
interface StudentForUpdate {
  id: string
  subscriptionStatus?: string | null
  stripeSubscriptionId?: string | null
  stripeSubscriptionIdDugsi?: string | null
}

/**
 * Build update data for a single student based on subscription changes.
 * Handles status tracking and subscription history for both Mahad and Dugsi programs.
 */
export function buildStudentUpdateData(
  student: StudentForUpdate,
  config: StudentUpdateConfig
): MahadStudentUpdateData | DugsiStudentUpdateData {
  const {
    subscriptionId,
    customerId,
    subscriptionStatus,
    newStudentStatus,
    periodStart,
    periodEnd,
    monthlyRate,
    program,
  } = config

  // Check if status actually changed to conditionally update timestamp
  const statusChanged = student.subscriptionStatus !== subscriptionStatus

  if (program === 'MAHAD') {
    const oldSubscriptionId = student.stripeSubscriptionId

    const updateData: MahadStudentUpdateData = {
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: subscriptionStatus as
        | 'active'
        | 'canceled'
        | 'past_due'
        | 'unpaid'
        | 'trialing'
        | 'incomplete'
        | 'incomplete_expired'
        | 'paused',
      status: newStudentStatus,
      paidUntil: periodEnd,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      ...(customerId && { stripeCustomerId: customerId }),
      ...(monthlyRate !== undefined && { monthlyRate }),
      // Only update timestamp if status actually changed
      ...(statusChanged && {
        subscriptionStatusUpdatedAt: new Date(),
      }),
    }

    // Track subscription history: add old subscription ID if it exists and is different
    if (oldSubscriptionId && oldSubscriptionId !== subscriptionId) {
      updateData.previousSubscriptionIds = {
        push: oldSubscriptionId,
      }
    }

    return updateData
  } else {
    // Dugsi program
    const oldSubscriptionId = student.stripeSubscriptionIdDugsi

    const updateData: DugsiStudentUpdateData = {
      stripeSubscriptionIdDugsi: subscriptionId,
      subscriptionStatus: subscriptionStatus as
        | 'active'
        | 'canceled'
        | 'past_due'
        | 'unpaid'
        | 'trialing'
        | 'incomplete'
        | 'incomplete_expired'
        | 'paused',
      status: newStudentStatus,
      paidUntil: periodEnd,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      stripeAccountType: 'DUGSI',
      ...(customerId && { stripeCustomerIdDugsi: customerId }),
      ...(monthlyRate !== undefined && { monthlyRate }),
      // Only update timestamp if status actually changed
      ...(statusChanged && {
        subscriptionStatusUpdatedAt: new Date(),
      }),
    }

    // Track subscription history: add old subscription ID if it exists and is different
    if (oldSubscriptionId && oldSubscriptionId !== subscriptionId) {
      updateData.previousSubscriptionIdsDugsi = {
        push: oldSubscriptionId,
      }
    }

    return updateData
  }
}

/**
 * Update multiple students with subscription data within a transaction.
 * Returns an array of update promises to be used with Promise.all().
 *
 * @example
 * ```typescript
 * await prisma.$transaction(async (tx) => {
 *   const students = await tx.student.findMany({ where: { ... } })
 *   const updatePromises = updateStudentsInTransaction(students, config, tx)
 *   await Promise.all(updatePromises)
 * })
 * ```
 */
export function updateStudentsInTransaction<T extends StudentForUpdate>(
  students: T[],
  config: StudentUpdateConfig,
  transactionClient: Prisma.TransactionClient
) {
  return students.map((student) => {
    const updateData = buildStudentUpdateData(student, config)

    return transactionClient.student.update({
      where: { id: student.id },
      data: updateData,
    })
  })
}

/**
 * Build cancellation update data for a student.
 * Used when a subscription is deleted.
 */
export function buildCancellationUpdateData(
  subscriptionId: string,
  program: 'MAHAD' | 'DUGSI'
): MahadStudentUpdateData | DugsiStudentUpdateData {
  const baseData = {
    subscriptionStatus: 'canceled' as const,
    status: 'withdrawn',
    subscriptionStatusUpdatedAt: new Date(),
    paidUntil: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  }

  if (program === 'MAHAD') {
    return {
      ...baseData,
      previousSubscriptionIds: {
        push: subscriptionId,
      },
      stripeSubscriptionId: null,
    }
  } else {
    return {
      ...baseData,
      previousSubscriptionIdsDugsi: {
        push: subscriptionId,
      },
      stripeSubscriptionIdDugsi: null,
    }
  }
}
