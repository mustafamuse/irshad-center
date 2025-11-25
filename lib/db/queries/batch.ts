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

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  ACTIVE_MAHAD_ENROLLMENT_WHERE,
  ACTIVE_ENROLLMENT_WHERE,
  extractContactInfo,
} from '@/lib/db/query-builders'
import { DatabaseClient } from '@/lib/db/types'

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

  // Map to BatchWithCount interface
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
      ...ACTIVE_ENROLLMENT_WHERE,
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
    include: {
      programProfile: {
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
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
    const { email, phone } = extractContactInfo(profile.person.contactPoints)

    return {
      id: profile.id,
      name: profile.person.name,
      email,
      phone,
      dateOfBirth: profile.person.dateOfBirth,
      educationLevel: profile.educationLevel,
      gradeLevel: profile.gradeLevel,
      schoolName: profile.schoolName,
      monthlyRate: profile.monthlyRate,
      customRate: profile.customRate,
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
 * Assign students to a batch (bulk update enrollments)
 * This updates existing enrollments or creates new ones
 */
export async function assignStudentsToBatch(
  batchId: string,
  studentIds: string[], // These are ProgramProfile IDs
  client: DatabaseClient = prisma
) {
  const results = {
    success: true,
    assignedCount: 0,
    failedAssignments: [] as string[],
    errors: [] as string[],
  }

  // Verify batch exists
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

  // Process each student
  for (const studentId of studentIds) {
    try {
      // Get or create active enrollment for this profile
      let enrollment = await client.enrollment.findFirst({
        where: {
          programProfileId: studentId,
          ...ACTIVE_ENROLLMENT_WHERE,
        },
      })

      if (enrollment) {
        // Update existing enrollment with new batch
        await client.enrollment.update({
          where: { id: enrollment.id },
          data: { batchId },
        })
      } else {
        // Create new enrollment with batch
        await client.enrollment.create({
          data: {
            programProfileId: studentId,
            batchId,
            status: 'ENROLLED',
            startDate: new Date(),
          },
        })
      }

      results.assignedCount++
    } catch (error) {
      results.failedAssignments.push(studentId)
      results.errors.push(
        `Failed to assign student ${studentId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  results.success = results.failedAssignments.length === 0

  return results
}

/**
 * Transfer students from one batch to another (bulk update)
 */
export async function transferStudents(
  fromBatchId: string,
  toBatchId: string,
  studentIds: string[], // These are ProgramProfile IDs
  client: DatabaseClient = prisma
) {
  const results = {
    success: true,
    transferredCount: 0,
    failedTransfers: [] as string[],
    errors: [] as string[],
  }

  // Verify both batches exist
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

  // Transfer each student
  for (const studentId of studentIds) {
    try {
      // Find active enrollment in source batch
      const enrollment = await client.enrollment.findFirst({
        where: {
          programProfileId: studentId,
          batchId: fromBatchId,
          ...ACTIVE_ENROLLMENT_WHERE,
        },
      })

      if (enrollment) {
        // Update enrollment to new batch
        await client.enrollment.update({
          where: { id: enrollment.id },
          data: { batchId: toBatchId },
        })
        results.transferredCount++
      } else {
        results.failedTransfers.push(studentId)
        results.errors.push(`Student ${studentId} not found in source batch`)
      }
    } catch (error) {
      results.failedTransfers.push(studentId)
      results.errors.push(
        `Failed to transfer student ${studentId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
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
            ...ACTIVE_ENROLLMENT_WHERE,
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
        none: ACTIVE_ENROLLMENT_WHERE,
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

  // Map to BatchWithCount interface
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
    include: {
      Enrollment: {
        where: ACTIVE_MAHAD_ENROLLMENT_WHERE,
        include: {
          programProfile: {
            include: {
              person: {
                include: {
                  contactPoints: true,
                },
              },
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
        // No enrollments at all
        {
          enrollments: {
            none: {},
          },
        },
        // Has enrollments but none with batchId
        {
          enrollments: {
            every: {
              OR: [{ batchId: null }, { status: 'WITHDRAWN' }],
            },
          },
        },
      ],
    },
    include: {
      person: {
        include: {
          contactPoints: true,
        },
      },
      enrollments: {
        where: ACTIVE_ENROLLMENT_WHERE,
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
    const { email, phone } = extractContactInfo(profile.person.contactPoints)

    return {
      id: profile.id,
      name: profile.person.name,
      email,
      phone,
      educationLevel: profile.educationLevel,
      gradeLevel: profile.gradeLevel,
      createdAt: profile.createdAt,
    }
  })
}
