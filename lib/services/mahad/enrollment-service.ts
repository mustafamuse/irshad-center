/**
 * Mahad Enrollment Service
 *
 * Business logic for Mahad student enrollment operations.
 * Handles batch assignments, transfers, and enrollment status management.
 *
 * Responsibilities:
 * - Assign students to batches (cohorts)
 * - Transfer students between batches
 * - Withdraw students from batches
 * - Get enrollment information
 */

import { EnrollmentStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  updateEnrollmentStatus,
  getEnrollmentById,
} from '@/lib/db/queries/enrollment'
import { ACTIVE_ENROLLMENT_WHERE } from '@/lib/db/query-builders'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'

const logger = createServiceLogger('mahad-enrollment')

/**
 * Enrollment assignment result
 */
export interface EnrollmentAssignmentResult {
  assignedCount: number
  failedAssignments: string[]
}

/**
 * Enrollment transfer result
 */
export interface EnrollmentTransferResult {
  transferredCount: number
  failedTransfers: string[]
}

/**
 * Assign multiple students to a batch (all-or-nothing).
 *
 * Runs in a single transaction: if any DB error occurs, all assignments
 * roll back and every studentId is reported in failedAssignments.
 * Skips students already enrolled in the target batch.
 *
 * @param batchId - Batch ID to assign students to
 * @param studentIds - Array of program profile IDs
 * @returns Assignment result with counts and failures
 */
export async function assignStudentsToBatch(
  batchId: string,
  studentIds: string[]
): Promise<EnrollmentAssignmentResult> {
  const result: EnrollmentAssignmentResult = {
    assignedCount: 0,
    failedAssignments: [],
  }

  try {
    await prisma.$transaction(async (tx) => {
      const activeEnrollments = await tx.enrollment.findMany({
        where: {
          programProfileId: { in: studentIds },
          ...ACTIVE_ENROLLMENT_WHERE,
        },
      })

      const alreadyInBatch = new Set(
        activeEnrollments
          .filter((e) => e.batchId === batchId)
          .map((e) => e.programProfileId)
      )

      const toWithdraw = activeEnrollments.filter((e) => e.batchId !== batchId)

      const now = new Date()

      if (toWithdraw.length > 0) {
        await tx.enrollment.updateMany({
          where: { id: { in: toWithdraw.map((e) => e.id) } },
          data: { status: 'WITHDRAWN', endDate: now },
        })
      }

      const toEnroll = studentIds.filter((id) => !alreadyInBatch.has(id))

      if (toEnroll.length > 0) {
        await tx.enrollment.createMany({
          data: toEnroll.map((studentId) => ({
            programProfileId: studentId,
            batchId,
            status: 'REGISTERED' as EnrollmentStatus,
            startDate: now,
          })),
        })
      }

      result.assignedCount = toEnroll.length
    })
  } catch (error) {
    if (error instanceof ActionError) throw error
    result.failedAssignments.push(...studentIds)
    await logError(logger, error, 'Failed to assign students to batch', {
      batchId,
      studentIds,
    })
  }

  return result
}

/**
 * Transfer multiple students from one batch to another (all-or-nothing).
 *
 * Runs in a single transaction: withdraws from current batch and enrolls
 * in target batch. If any student lacks an active enrollment, the entire
 * transfer rolls back and all IDs are reported in failedTransfers.
 *
 * @param studentIds - Array of program profile IDs
 * @param targetBatchId - Target batch ID
 * @returns Transfer result with counts and failures
 */
export async function transferStudentsToBatch(
  studentIds: string[],
  targetBatchId: string
): Promise<EnrollmentTransferResult> {
  const result: EnrollmentTransferResult = {
    transferredCount: 0,
    failedTransfers: [],
  }

  try {
    await prisma.$transaction(async (tx) => {
      const activeEnrollments = await tx.enrollment.findMany({
        where: {
          programProfileId: { in: studentIds },
          ...ACTIVE_ENROLLMENT_WHERE,
        },
      })

      const enrolledStudentIds = new Set(
        activeEnrollments.map((e) => e.programProfileId)
      )
      const missingStudents = studentIds.filter(
        (id) => !enrolledStudentIds.has(id)
      )

      if (missingStudents.length > 0) {
        throw new ActionError(
          `No active enrollment found for student(s): ${missingStudents.join(', ')}`,
          ERROR_CODES.ENROLLMENT_NOT_FOUND,
          undefined,
          404
        )
      }

      const now = new Date()

      await tx.enrollment.updateMany({
        where: { id: { in: activeEnrollments.map((e) => e.id) } },
        data: { status: 'WITHDRAWN', endDate: now },
      })

      await tx.enrollment.createMany({
        data: studentIds.map((studentId) => ({
          programProfileId: studentId,
          batchId: targetBatchId,
          status: 'REGISTERED' as EnrollmentStatus,
          startDate: now,
        })),
      })

      result.transferredCount = studentIds.length
    })
  } catch (error) {
    if (error instanceof ActionError) throw error
    result.failedTransfers.push(...studentIds)
    await logError(logger, error, 'Failed to transfer students', {
      studentIds,
      targetBatchId,
    })
  }

  return result
}

/**
 * Withdraw a student from their current batch.
 *
 * Sets enrollment status to WITHDRAWN and records end date.
 *
 * @param studentId - Program profile ID
 * @returns Updated enrollment
 */
export async function withdrawStudentFromBatch(studentId: string) {
  // Find active enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      programProfileId: studentId,
      status: { not: 'WITHDRAWN' },
      endDate: null,
    },
  })

  if (!enrollment) {
    throw new ActionError(
      'No active enrollment found for student',
      ERROR_CODES.ENROLLMENT_NOT_FOUND,
      undefined,
      404
    )
  }

  return await updateEnrollmentStatus(
    enrollment.id,
    'WITHDRAWN',
    null,
    new Date()
  )
}

/**
 * Get enrollment details for a student.
 *
 * @param enrollmentId - Enrollment ID
 * @returns Enrollment with batch and profile information
 */
export async function getEnrollmentDetails(enrollmentId: string) {
  return await getEnrollmentById(enrollmentId)
}

/**
 * Get active enrollment for a student.
 *
 * @param studentId - Program profile ID
 * @returns Active enrollment or null
 */
export async function getActiveEnrollment(studentId: string) {
  return await prisma.enrollment.findFirst({
    relationLoadStrategy: 'join',
    where: {
      programProfileId: studentId,
      status: { not: 'WITHDRAWN' },
      endDate: null,
    },
    include: {
      batch: true,
      programProfile: {
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
        },
      },
    },
  })
}

/**
 * Update enrollment status.
 *
 * @param enrollmentId - Enrollment ID
 * @param status - New enrollment status
 * @param metadata - Optional metadata (endDate, notes)
 * @returns Updated enrollment
 */
export async function updateEnrollment(
  enrollmentId: string,
  status: EnrollmentStatus,
  metadata?: {
    endDate?: Date | null
    notes?: string
  }
) {
  return await updateEnrollmentStatus(
    enrollmentId,
    status,
    metadata?.notes || null,
    metadata?.endDate
  )
}
