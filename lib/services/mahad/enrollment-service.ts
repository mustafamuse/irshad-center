/**
 * Mahad Enrollment Service
 *
 * Business logic for Mahad student enrollment operations.
 * Handles withdrawal and enrollment status management.
 *
 * Note: Batch assignment and transfer operations live in lib/db/queries/batch.ts.
 */

import { EnrollmentStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  updateEnrollmentStatus,
  getEnrollmentById,
} from '@/lib/db/queries/enrollment'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'

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
