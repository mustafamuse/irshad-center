/**
 * Enrollment Query Functions
 *
 * Query functions for managing Enrollment records (time-bounded participation records).
 * Enrollments link ProgramProfiles to Batches (Mahad only) and track status over time.
 */

import { Prisma, EnrollmentStatus, Program } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  ACTIVE_ENROLLMENT_WHERE,
  ENROLLMENT_WITH_PROFILE_INCLUDE,
} from '@/lib/db/query-builders'
import { DatabaseClient } from '@/lib/db/types'
import { createServiceLogger, logError } from '@/lib/logger'
import {
  isValidStatusTransition,
  ENROLLMENT_STATUS_TRANSITIONS,
} from '@/lib/types/enrollment'

const logger = createServiceLogger('enrollment')

/**
 * Validate enrollment data before creation
 *
 * Business Rules:
 * - Dugsi enrollments cannot have a batchId (enforced at application level)
 * - Mahad enrollments can optionally have a batchId
 *
 * @throws Error if validation fails
 */
async function validateEnrollmentData(
  data: {
    programProfileId: string
    program: Program
    batchId?: string | null
    status: EnrollmentStatus
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _client?: DatabaseClient
): Promise<void> {
  // CRITICAL: Dugsi enrollments must NOT have a batchId
  // Dugsi students are assigned to teachers, not batches
  if (data.program === 'DUGSI_PROGRAM' && data.batchId) {
    throw new Error(
      'Dugsi enrollments cannot have a batchId. Dugsi students are assigned to teachers, not batches.'
    )
  }
}

/**
 * Get all enrollments for a program profile
 * @param client - Optional database client (for transaction support)
 */
export async function getEnrollmentsByProgramProfile(
  profileId: string,
  client: DatabaseClient = prisma
) {
  return client.enrollment.findMany({
    where: {
      programProfileId: profileId,
    },
    include: ENROLLMENT_WITH_PROFILE_INCLUDE,
    orderBy: {
      startDate: 'desc',
    },
  })
}

/**
 * Get active enrollment for a program profile
 * @param client - Optional database client (for transaction support)
 */
export async function getActiveEnrollment(
  profileId: string,
  client: DatabaseClient = prisma
) {
  return client.enrollment.findFirst({
    where: {
      programProfileId: profileId,
      ...ACTIVE_ENROLLMENT_WHERE,
    },
    include: {
      batch: true,
      programProfile: {
        include: {
          person: true,
        },
      },
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}

/**
 * Get enrollments for a batch (Mahad only)
 * @param client - Optional database client (for transaction support)
 */
export async function getEnrollmentsByBatch(
  batchId: string,
  status?: EnrollmentStatus,
  client: DatabaseClient = prisma
) {
  return client.enrollment.findMany({
    where: {
      batchId,
      status: status || { not: 'WITHDRAWN' },
      endDate: null,
    },
    include: ENROLLMENT_WITH_PROFILE_INCLUDE,
    orderBy: {
      startDate: 'desc',
    },
  })
}

/**
 * Get enrollment by ID with full relations
 * @param client - Optional database client (for transaction support)
 */
export async function getEnrollmentById(
  enrollmentId: string,
  client: DatabaseClient = prisma
) {
  return client.enrollment.findUnique({
    where: {
      id: enrollmentId,
    },
    include: ENROLLMENT_WITH_PROFILE_INCLUDE,
  })
}

/**
 * Create a new enrollment with validation
 * Validates that Dugsi enrollments cannot have batchId
 *
 * @param data - Enrollment data
 * @param client - Optional database client (for transaction support)
 */
export async function createEnrollment(
  data: {
    programProfileId: string
    batchId?: string | null
    status?: EnrollmentStatus
    startDate?: Date
    reason?: string | null
    notes?: string | null
  },
  client: DatabaseClient = prisma
) {
  logger.info(
    {
      programProfileId: data.programProfileId,
      batchId: data.batchId,
      status: data.status,
    },
    'Creating enrollment - fetching program profile'
  )

  // Get program profile to check program type
  const profile = await client.programProfile.findUnique({
    where: { id: data.programProfileId },
    select: { program: true },
  })

  if (!profile) {
    const error = new Error(
      `ProgramProfile not found: ${data.programProfileId}`
    )
    await logError(
      logger,
      error,
      'ProgramProfile not found in createEnrollment',
      {
        programProfileId: data.programProfileId,
      }
    )
    throw error
  }

  logger.info(
    {
      programProfileId: data.programProfileId,
      program: profile.program,
      batchId: data.batchId,
    },
    'Program profile found, validating enrollment'
  )

  // Validate enrollment data (checks Dugsi batchId constraint)
  // CRITICAL: Pass transaction client so validation can see uncommitted data
  await validateEnrollmentData(
    {
      programProfileId: data.programProfileId,
      program: profile.program,
      batchId: data.batchId,
      status: data.status || 'REGISTERED',
    },
    client // Pass transaction client for visibility into uncommitted data
  )

  logger.info(
    {
      programProfileId: data.programProfileId,
      program: profile.program,
    },
    'Validation passed, creating enrollment record'
  )

  return client.enrollment.create({
    data: {
      programProfileId: data.programProfileId,
      batchId: data.batchId,
      status: data.status || 'REGISTERED',
      startDate: data.startDate || new Date(),
      reason: data.reason,
      notes: data.notes,
    },
    include: {
      programProfile: {
        include: {
          person: true,
        },
      },
      batch: true,
    },
  })
}

/**
 * Update enrollment status with history tracking
 * When withdrawing, sets endDate. When re-enrolling, creates new enrollment.
 * @param client - Optional database client (for transaction support)
 */
export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentStatus,
  reason?: string | null,
  endDate?: Date | null,
  client: DatabaseClient = prisma
) {
  const enrollment = await client.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      programProfile: {
        select: { program: true },
      },
    },
  })

  if (!enrollment) {
    throw new Error(`Enrollment not found: ${enrollmentId}`)
  }

  // Validate status transition
  if (!isValidStatusTransition(enrollment.status, status)) {
    throw new Error(
      `Invalid status transition from ${enrollment.status} to ${status}. ` +
        `This enrollment can only transition to: ${ENROLLMENT_STATUS_TRANSITIONS[enrollment.status]?.join(', ') || 'none'}`
    )
  }

  // If withdrawing, set endDate
  const finalEndDate =
    endDate !== undefined
      ? endDate
      : status === 'WITHDRAWN'
        ? new Date()
        : enrollment.endDate

  return client.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status,
      endDate: finalEndDate,
      reason,
    },
    include: {
      programProfile: {
        include: {
          person: true,
        },
      },
      batch: true,
    },
  })
}

/**
 * Re-enroll a student (create new enrollment after withdrawal)
 * @param client - Optional database client (for transaction support)
 */
export async function reEnrollStudent(
  programProfileId: string,
  batchId?: string | null,
  notes?: string | null,
  client: DatabaseClient = prisma
) {
  // Get program profile to check program type
  const profile = await client.programProfile.findUnique({
    where: { id: programProfileId },
    select: { program: true },
  })

  if (!profile) {
    throw new Error(`ProgramProfile not found: ${programProfileId}`)
  }

  // Validate enrollment data
  await validateEnrollmentData({
    programProfileId,
    program: profile.program,
    batchId,
    status: 'REGISTERED',
  })

  return client.enrollment.create({
    data: {
      programProfileId,
      batchId,
      status: 'REGISTERED',
      startDate: new Date(),
      notes,
    },
    include: {
      programProfile: {
        include: {
          person: true,
        },
      },
      batch: true,
    },
  })
}

/**
 * Get enrollments by program
 * @param client - Optional database client (for transaction support)
 */
export async function getEnrollmentsByProgram(
  program: Program,
  status?: EnrollmentStatus,
  client: DatabaseClient = prisma
) {
  const where: Prisma.EnrollmentWhereInput = {
    programProfile: {
      program,
    },
    ...(status ? { status } : { status: { not: 'WITHDRAWN' } }),
    endDate: null, // Active enrollments only
  }

  return client.enrollment.findMany({
    where,
    include: ENROLLMENT_WITH_PROFILE_INCLUDE,
    orderBy: {
      startDate: 'desc',
    },
  })
}
