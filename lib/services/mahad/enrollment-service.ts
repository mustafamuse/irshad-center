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
  createEnrollment,
  updateEnrollmentStatus,
  getEnrollmentById,
} from '@/lib/db/queries/enrollment'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger } from '@/lib/logger'

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
 * Assign multiple students to a batch.
 *
 * Creates new enrollments for students not already in the batch.
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

  for (const studentId of studentIds) {
    try {
      // Wrap each student's assignment in a transaction for atomicity
      await prisma.$transaction(async (tx) => {
        // Check if student already enrolled in this batch
        const existingEnrollment = await tx.enrollment.findFirst({
          where: {
            programProfileId: studentId,
            batchId,
            status: { not: 'WITHDRAWN' },
            endDate: null,
          },
        })

        if (existingEnrollment) {
          // Skip if already enrolled
          return
        }

        // Check if student has active enrollment in another batch
        const activeEnrollment = await tx.enrollment.findFirst({
          where: {
            programProfileId: studentId,
            status: { not: 'WITHDRAWN' },
            endDate: null,
          },
        })

        if (activeEnrollment) {
          // Withdraw from current batch first
          await updateEnrollmentStatus(
            activeEnrollment.id,
            'WITHDRAWN',
            null,
            new Date(),
            tx
          )
        }

        // Create new enrollment
        await createEnrollment(
          {
            programProfileId: studentId,
            batchId,
            status: 'ENROLLED',
            startDate: new Date(),
          },
          tx
        )
      })

      result.assignedCount++
    } catch (error) {
      result.failedAssignments.push(studentId)
      logger.error({ err: error, studentId }, 'Failed to assign student')
    }
  }

  return result
}

/**
 * Transfer multiple students from one batch to another.
 *
 * Withdraws students from current batch and enrolls in target batch.
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

  for (const studentId of studentIds) {
    try {
      // Wrap each student's transfer in a transaction for atomicity
      await prisma.$transaction(async (tx) => {
        // Get current active enrollment
        const currentEnrollment = await tx.enrollment.findFirst({
          where: {
            programProfileId: studentId,
            status: { not: 'WITHDRAWN' },
            endDate: null,
          },
        })

        if (!currentEnrollment) {
          throw new ActionError(
            'No active enrollment found',
            ERROR_CODES.ENROLLMENT_NOT_FOUND,
            undefined,
            404
          )
        }

        // Withdraw from current batch
        await updateEnrollmentStatus(
          currentEnrollment.id,
          'WITHDRAWN',
          null,
          new Date(),
          tx
        )

        // Enroll in new batch
        await createEnrollment(
          {
            programProfileId: studentId,
            batchId: targetBatchId,
            status: 'ENROLLED',
            startDate: new Date(),
          },
          tx
        )
      })

      result.transferredCount++
    } catch (error) {
      result.failedTransfers.push(studentId)
      logger.error({ err: error, studentId }, 'Failed to transfer student')
    }
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
