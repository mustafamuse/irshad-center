import type { EnrollmentStatus, Program } from '@prisma/client'

/**
 * Enrollment - Time-bounded participation record
 */
export interface Enrollment {
  id: string
  programProfileId: string
  batchId: string | null
  status: EnrollmentStatus
  startDate: Date
  endDate: Date | null
  reason: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Enrollment with related data
 */
export interface EnrollmentWithRelations extends Enrollment {
  programProfile: {
    id: string
    personId: string
    program: Program
    status: EnrollmentStatus
  }
  batch: {
    id: string
    name: string
  } | null
}

/**
 * Enrollment status transitions
 */
export const ENROLLMENT_STATUS_TRANSITIONS: Record<
  EnrollmentStatus,
  EnrollmentStatus[]
> = {
  REGISTERED: ['ENROLLED', 'WITHDRAWN'],
  ENROLLED: ['ON_LEAVE', 'WITHDRAWN', 'COMPLETED', 'SUSPENDED'],
  ON_LEAVE: ['ENROLLED', 'WITHDRAWN'],
  WITHDRAWN: ['REGISTERED', 'ENROLLED'], // Re-enrollment
  COMPLETED: [],
  SUSPENDED: ['ENROLLED', 'WITHDRAWN'],
}

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  from: EnrollmentStatus,
  to: EnrollmentStatus
): boolean {
  return ENROLLMENT_STATUS_TRANSITIONS[from]?.includes(to) || false
}

/**
 * Helper to check if enrollment is active
 */
export function isActiveEnrollment(enrollment: Enrollment): boolean {
  return (
    enrollment.status === 'ENROLLED' &&
    !enrollment.endDate &&
    enrollment.startDate <= new Date()
  )
}

/**
 * Helper to get enrollment duration in days
 */
export function getEnrollmentDuration(enrollment: Enrollment): number | null {
  if (!enrollment.endDate) return null
  const start = enrollment.startDate.getTime()
  const end = enrollment.endDate.getTime()
  return Math.floor((end - start) / (1000 * 60 * 60 * 24))
}
