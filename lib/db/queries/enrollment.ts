/**
 * Enrollment Query Functions
 *
 * Query functions for managing Enrollment records (time-bounded participation records).
 * Enrollments link ProgramProfiles to Batches (Mahad only) and track status over time.
 */

import { Prisma, EnrollmentStatus, Program } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'
import { validateEnrollment } from '@/lib/services/validation-service'

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
    include: {
      batch: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
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
      status: { not: 'WITHDRAWN' },
      endDate: null,
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
    include: {
      programProfile: {
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
        },
      },
      batch: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
    },
    orderBy: {
      startDate: 'desc',
    },
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
  // Get program profile to check program type
  const profile = await client.programProfile.findUnique({
    where: { id: data.programProfileId },
    select: { program: true },
  })

  if (!profile) {
    throw new Error(`ProgramProfile not found: ${data.programProfileId}`)
  }

  // Validate enrollment data (checks Dugsi batchId constraint)
  await validateEnrollment({
    programProfileId: data.programProfileId,
    program: profile.program,
    batchId: data.batchId,
    status: data.status || 'REGISTERED',
  })

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
  await validateEnrollment({
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
    include: {
      programProfile: {
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
        },
      },
      batch: true,
    },
    orderBy: {
      startDate: 'desc',
    },
  })
}
