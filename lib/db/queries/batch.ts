/**
 * Batch Query Functions (Migrated to ProgramProfile/Enrollment Model)
 *
 * These functions manage cohorts (batches) for Mahad students. Batches are used
 * to group students by enrollment period. Note: Dugsi does NOT use batches - they
 * use family-based grouping instead.
 *
 * Migration Status: ✅ COMPLETE
 * - All functions migrated from legacy Student model
 * - Uses Enrollment model to count students
 * - Maintains backward-compatible return types for UI components
 */

import { EnrollmentStatus, Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { ACTIVE_MAHAD_ENROLLMENT_WHERE } from '@/lib/db/query-builders'
import { DatabaseClient, isPrismaClient } from '@/lib/db/types'
import { createServiceLogger, logError } from '@/lib/logger'

const logger = createServiceLogger('batch-queries')

/**
 * Type representing a batch with student count
 */
export interface BatchWithCount {
  id: string
  name: string
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
  updatedAt: Date
  studentCount: number
}

/**
 * Get batches as lightweight dropdown options, excluding the 'Test' batch.
 */
export async function getBatchDropdownOptions(
  client: DatabaseClient = prisma
): Promise<{ id: string; name: string }[]> {
  return client.batch.findMany({
    select: { id: true, name: true },
    where: { name: { not: 'Test' } },
    orderBy: { name: 'asc' },
  })
}

/**
 * Get all batches with student count (excluding withdrawn students)
 */
export async function getBatches(
  client: DatabaseClient = prisma
): Promise<BatchWithCount[]> {
  // Get all batches with counts in a single query using Prisma's _count API
  const batches = await client.batch.findMany({
    orderBy: {
      startDate: 'desc',
    },
    include: {
      _count: {
        select: {
          Enrollment: {
            where: ACTIVE_MAHAD_ENROLLMENT_WHERE,
          },
        },
      },
    },
  })

  return batches.map((batch) => ({
    id: batch.id,
    name: batch.name,
    startDate: batch.startDate,
    endDate: batch.endDate,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    studentCount: batch._count.Enrollment,
  }))
}

/**
 * Get a single batch by ID (excluding withdrawn students from count)
 */
export async function getBatchById(
  id: string,
  client: DatabaseClient = prisma
): Promise<BatchWithCount | null> {
  const batch = await client.batch.findUnique({
    where: { id },
  })

  if (!batch) return null

  // Count active enrollments (not withdrawn) for Mahad students
  const studentCount = await client.enrollment.count({
    where: {
      batchId: id,
      ...ACTIVE_MAHAD_ENROLLMENT_WHERE,
    },
  })

  return {
    ...batch,
    studentCount,
  }
}

/**
 * Check if a batch with the given name exists (case-insensitive)
 */
export async function getBatchByName(
  name: string,
  client: DatabaseClient = prisma
): Promise<BatchWithCount | null> {
  const batch = await client.batch.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  })

  if (!batch) return null

  // Count active enrollments
  const studentCount = await client.enrollment.count({
    where: {
      batchId: batch.id,
      ...ACTIVE_MAHAD_ENROLLMENT_WHERE,
    },
  })

  return {
    ...batch,
    studentCount,
  }
}

/**
 * Create a new batch
 * Note: Use admin actions for creation with proper authorization
 */
export async function createBatch(
  data: {
    name: string
    startDate?: Date | null
    endDate?: Date | null
  },
  client: DatabaseClient = prisma
): Promise<BatchWithCount> {
  const batch = await client.batch.create({
    data: {
      name: data.name,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
    },
  })

  return {
    ...batch,
    studentCount: 0, // New batch has no students
  }
}

/**
 * Update a batch
 * Note: Use admin actions for updates with proper authorization
 *
 * Uses partial update pattern - only updates fields that are explicitly provided.
 * Undefined fields are not touched, null fields are set to null.
 */
export async function updateBatch(
  id: string,
  data: {
    name?: string
    startDate?: Date | null
    endDate?: Date | null
  },
  client: DatabaseClient = prisma
): Promise<BatchWithCount> {
  // Build update data object with only provided fields
  // This ensures undefined fields don't accidentally overwrite existing values
  const updateData: {
    name?: string
    startDate?: Date | null
    endDate?: Date | null
  } = {}

  if (data.name !== undefined) {
    updateData.name = data.name
  }
  if (data.startDate !== undefined) {
    updateData.startDate = data.startDate
  }
  if (data.endDate !== undefined) {
    updateData.endDate = data.endDate
  }

  const batch = await client.batch.update({
    where: { id },
    data: updateData,
  })

  // Get current student count
  const studentCount = await client.enrollment.count({
    where: {
      batchId: id,
      ...ACTIVE_MAHAD_ENROLLMENT_WHERE,
    },
  })

  return {
    ...batch,
    studentCount,
  }
}

/**
 * Delete a batch
 * Note: This will fail if there are active enrollments linked to this batch
 * The database has a foreign key constraint preventing orphaned enrollments
 */
export async function deleteBatch(id: string, client: DatabaseClient = prisma) {
  // Check if batch has students
  const studentCount = await client.enrollment.count({
    where: {
      batchId: id,
      ...ACTIVE_MAHAD_ENROLLMENT_WHERE,
    },
  })

  if (studentCount > 0) {
    throw new Error(
      `Cannot delete batch with ${studentCount} active students. Remove or reassign students first.`
    )
  }

  return await client.batch.delete({
    where: { id },
  })
}

/**
 * Get all students in a batch
 * Returns ProgramProfile data for students with active enrollments in the batch
 */
export async function getBatchStudents(
  batchId: string,
  client: DatabaseClient = prisma
) {
  const enrollments = await client.enrollment.findMany({
    where: {
      batchId,
      ...ACTIVE_MAHAD_ENROLLMENT_WHERE,
    },
    relationLoadStrategy: 'join',
    include: {
      programProfile: {
        include: {
          person: true,
          assignments: {
            where: { isActive: true },
            include: {
              subscription: true,
            },
            take: 1,
          },
        },
      },
      batch: true,
    },
    orderBy: {
      programProfile: {
        person: {
          name: 'asc',
        },
      },
    },
  })

  // Transform to student-like structure
  return enrollments.map((enrollment) => {
    const profile = enrollment.programProfile

    return {
      id: profile.id,
      name: profile.person.name,
      email: profile.person.email,
      phone: profile.person.phone,
      dateOfBirth: profile.person.dateOfBirth,
      gradeLevel: profile.gradeLevel,
      schoolName: profile.schoolName,
      // Mahad billing fields
      graduationStatus: profile.graduationStatus,
      paymentFrequency: profile.paymentFrequency,
      billingType: profile.billingType,
      paymentNotes: profile.paymentNotes,
      enrollmentId: enrollment.id,
      enrollmentStatus: enrollment.status,
      enrollmentStartDate: enrollment.startDate,
      batch: enrollment.batch,
      subscription: profile.assignments[0]?.subscription || null,
    }
  })
}

/**
 * Get the count of students in a batch (active enrollments only)
 */
export async function getBatchStudentCount(
  batchId: string,
  client: DatabaseClient = prisma
): Promise<number> {
  return await client.enrollment.count({
    where: {
      batchId,
      ...ACTIVE_MAHAD_ENROLLMENT_WHERE,
    },
  })
}

/**
 * Assign students to a batch using batch operations (single transaction).
 *
 * Withdraws existing enrollments (preserving history) then creates new ones.
 * Students already in the target batch are skipped.
 */
export async function assignStudentsToBatch(
  batchId: string,
  studentIds: string[],
  client: DatabaseClient = prisma
) {
  const results = {
    success: true,
    assignedCount: 0,
    failedAssignments: [] as string[],
    errors: [] as string[],
  }

  const batch = await client.batch.findUnique({
    where: { id: batchId },
  })

  if (!batch) {
    return {
      success: false,
      assignedCount: 0,
      failedAssignments: studentIds,
      errors: ['Batch not found'],
    }
  }

  async function runAssign(tx: DatabaseClient) {
    const activeEnrollments = await tx.enrollment.findMany({
      where: {
        programProfileId: { in: studentIds },
        ...ACTIVE_MAHAD_ENROLLMENT_WHERE,
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
        data: { status: 'WITHDRAWN' as EnrollmentStatus, endDate: now },
      })
    }

    const toEnroll = studentIds.filter((id) => !alreadyInBatch.has(id))
    if (toEnroll.length > 0) {
      await tx.enrollment.createMany({
        data: toEnroll.map((id) => ({
          programProfileId: id,
          batchId,
          status: 'REGISTERED' as EnrollmentStatus,
          startDate: now,
        })),
      })
    }

    return toEnroll.length
  }

  try {
    const count = isPrismaClient(client)
      ? await client.$transaction((tx) => runAssign(tx))
      : await runAssign(client)
    results.assignedCount = count
  } catch (error) {
    await logError(logger, error, 'Failed to assign students to batch', {
      batchId,
      studentIds,
    })
    results.failedAssignments.push(...studentIds)
    results.errors.push(
      `Failed to assign students: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    results.success = false
  }

  return results
}

/**
 * Transfer students from one batch to another using batch operations
 * (single transaction).
 *
 * Students not found in the source batch are reported in failedTransfers
 * but do not abort the entire operation.
 */
export async function transferStudents(
  fromBatchId: string,
  toBatchId: string,
  studentIds: string[],
  client: DatabaseClient = prisma
) {
  const results = {
    success: true,
    transferredCount: 0,
    failedTransfers: [] as string[],
    errors: [] as string[],
  }

  const [fromBatch, toBatch] = await Promise.all([
    client.batch.findUnique({ where: { id: fromBatchId } }),
    client.batch.findUnique({ where: { id: toBatchId } }),
  ])

  if (!fromBatch || !toBatch) {
    return {
      success: false,
      transferredCount: 0,
      failedTransfers: studentIds,
      errors: ['Source or destination batch not found'],
    }
  }

  async function runTransfer(tx: DatabaseClient) {
    const activeEnrollments = await tx.enrollment.findMany({
      where: {
        programProfileId: { in: studentIds },
        batchId: fromBatchId,
        ...ACTIVE_MAHAD_ENROLLMENT_WHERE,
      },
    })

    const enrolledIds = new Set(
      activeEnrollments.map((e) => e.programProfileId)
    )
    const missing = studentIds.filter((id) => !enrolledIds.has(id))

    let transferred = 0
    if (activeEnrollments.length > 0) {
      const now = new Date()
      await tx.enrollment.updateMany({
        where: { id: { in: activeEnrollments.map((e) => e.id) } },
        data: { status: 'WITHDRAWN' as EnrollmentStatus, endDate: now },
      })
      await tx.enrollment.createMany({
        data: activeEnrollments.map((e) => ({
          programProfileId: e.programProfileId,
          batchId: toBatchId,
          status: 'REGISTERED' as EnrollmentStatus,
          startDate: now,
        })),
      })
      transferred = activeEnrollments.length
    }

    return { transferred, missing }
  }

  try {
    const { transferred, missing } = isPrismaClient(client)
      ? await client.$transaction((tx) => runTransfer(tx))
      : await runTransfer(client)

    results.transferredCount = transferred
    if (missing.length > 0) {
      results.failedTransfers.push(...missing)
      results.errors.push(
        ...missing.map((id) => `Student ${id} not found in source batch`)
      )
    }
  } catch (error) {
    await logError(
      logger,
      error,
      'Failed to transfer students between batches',
      { fromBatchId, toBatchId, studentIds }
    )
    results.failedTransfers.push(...studentIds)
    results.errors.push(
      `Failed to transfer students: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  results.success = results.failedTransfers.length === 0

  return results
}

/**
 * Get batch summary statistics
 */
export async function getBatchSummary(client: DatabaseClient = prisma) {
  const [totalBatches, totalStudents, batchesWithStudents] = await Promise.all([
    // Total number of batches
    client.batch.count(),
    // Total active Mahad students (unique program profiles with active enrollments)
    client.programProfile.count({
      where: {
        program: 'MAHAD_PROGRAM',
        enrollments: {
          some: {
            ...ACTIVE_MAHAD_ENROLLMENT_WHERE,
            batchId: { not: null }, // Only count students assigned to batches
          },
        },
      },
    }),
    // Count batches that have at least one student
    client.batch.findMany({
      where: {
        Enrollment: {
          some: ACTIVE_MAHAD_ENROLLMENT_WHERE,
        },
      },
    }),
  ])

  const activeBatches = batchesWithStudents.length
  const averageStudentsPerBatch =
    activeBatches > 0 ? Math.round(totalStudents / activeBatches) : 0

  return {
    totalBatches,
    totalStudents,
    activeBatches,
    averageStudentsPerBatch,
  }
}

/**
 * Get batches with filters applied
 */
export async function getBatchesWithFilters(
  filters: {
    search?: string
    hasStudents?: boolean
    dateRange?: {
      from: Date
      to: Date
    }
  },
  client: DatabaseClient = prisma
): Promise<BatchWithCount[]> {
  const where: Prisma.BatchWhereInput = {}

  // Search by batch name
  if (filters.search) {
    where.name = {
      contains: filters.search,
      mode: 'insensitive',
    }
  }

  // Filter by date range (startDate within range)
  if (filters.dateRange) {
    where.startDate = {
      gte: filters.dateRange.from,
      lte: filters.dateRange.to,
    }
  }

  // Filter by has students
  if (filters.hasStudents !== undefined) {
    if (filters.hasStudents) {
      // Only batches with at least one active enrollment
      where.Enrollment = {
        some: ACTIVE_MAHAD_ENROLLMENT_WHERE,
      }
    } else {
      // Only batches with no active enrollments
      where.Enrollment = {
        none: ACTIVE_MAHAD_ENROLLMENT_WHERE,
      }
    }
  }

  // Get batches with counts in a single query using Prisma's _count API
  const batches = await client.batch.findMany({
    where,
    orderBy: {
      startDate: 'desc',
    },
    include: {
      _count: {
        select: {
          Enrollment: {
            where: ACTIVE_MAHAD_ENROLLMENT_WHERE,
          },
        },
      },
    },
  })

  return batches.map((batch) => ({
    id: batch.id,
    name: batch.name,
    startDate: batch.startDate,
    endDate: batch.endDate,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    studentCount: batch._count.Enrollment,
  }))
}

/**
 * Get batches with full details including enrollments
 * Useful for detailed batch management views
 */
export async function getBatchWithEnrollments(
  batchId: string,
  client: DatabaseClient = prisma
) {
  const batch = await client.batch.findUnique({
    where: { id: batchId },
    relationLoadStrategy: 'join',
    include: {
      Enrollment: {
        where: ACTIVE_MAHAD_ENROLLMENT_WHERE,
        include: {
          programProfile: {
            include: {
              person: true,
              assignments: {
                where: { isActive: true },
                include: {
                  subscription: true,
                },
              },
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
      },
    },
  })

  if (!batch) return null

  return {
    ...batch,
    studentCount: batch.Enrollment.length,
  }
}

/**
 * Get unassigned students (students without a batch assignment)
 * Returns ProgramProfiles for Mahad students with no batch
 */
export async function getUnassignedStudents(client: DatabaseClient = prisma) {
  const profiles = await client.programProfile.findMany({
    where: {
      program: 'MAHAD_PROGRAM',
      OR: [
        {
          enrollments: {
            none: {},
          },
        },
        {
          enrollments: {
            every: {
              OR: [{ batchId: null }, { status: 'WITHDRAWN' }],
            },
          },
        },
      ],
    },
    relationLoadStrategy: 'join',
    include: {
      person: true,
      enrollments: {
        where: ACTIVE_MAHAD_ENROLLMENT_WHERE,
        orderBy: {
          startDate: 'desc',
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return profiles.map((profile) => {
    return {
      id: profile.id,
      name: profile.person.name,
      email: profile.person.email,
      phone: profile.person.phone,
      gradeLevel: profile.gradeLevel,
      graduationStatus: profile.graduationStatus,
      billingType: profile.billingType,
      createdAt: profile.createdAt,
    }
  })
}
