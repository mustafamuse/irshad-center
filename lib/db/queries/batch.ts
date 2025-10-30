/**
 * Batch Query Functions
 *
 * Direct Prisma queries for batch operations following Next.js App Router best practices.
 * These functions replace the Repository/Service pattern with simple, composable query functions.
 */

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'

/**
 * Get all batches with student count (excluding withdrawn students)
 */
export async function getBatches() {
  const batches = await prisma.batch.findMany({
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
      Student: {
        where: {
          status: {
            not: 'withdrawn',
          },
        },
        select: { id: true },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return batches.map((batch) => ({
    id: batch.id,
    name: batch.name,
    startDate: batch.startDate,
    endDate: batch.endDate,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    studentCount: batch.Student.length,
  }))
}

/**
 * Get a single batch by ID (excluding withdrawn students from count)
 */
export async function getBatchById(id: string) {
  const batch = await prisma.batch.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
      Student: {
        where: {
          status: {
            not: 'withdrawn',
          },
        },
        select: { id: true },
      },
    },
  })

  if (!batch) return null

  return {
    id: batch.id,
    name: batch.name,
    startDate: batch.startDate,
    endDate: batch.endDate,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    studentCount: batch.Student.length,
  }
}

/**
 * Check if a batch with the given name exists (case-insensitive)
 */
export async function getBatchByName(name: string) {
  const batch = await prisma.batch.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return batch
}

/**
 * Create a new batch (student count excludes withdrawn)
 */
export async function createBatch(data: {
  name: string
  startDate?: Date | null
}) {
  const batch = await prisma.batch.create({
    data: {
      name: data.name,
      startDate: data.startDate || null,
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
      Student: {
        where: {
          status: {
            not: 'withdrawn',
          },
        },
        select: { id: true },
      },
    },
  })

  return {
    id: batch.id,
    name: batch.name,
    startDate: batch.startDate,
    endDate: batch.endDate,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    studentCount: batch.Student.length,
  }
}

/**
 * Update a batch (student count excludes withdrawn)
 */
export async function updateBatch(
  id: string,
  data: {
    name?: string
    startDate?: Date | null
    endDate?: Date | null
  }
) {
  const batch = await prisma.batch.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
      Student: {
        where: {
          status: {
            not: 'withdrawn',
          },
        },
        select: { id: true },
      },
    },
  })

  return {
    id: batch.id,
    name: batch.name,
    startDate: batch.startDate,
    endDate: batch.endDate,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    studentCount: batch.Student.length,
  }
}

/**
 * Delete a batch
 */
export async function deleteBatch(id: string) {
  await prisma.batch.delete({
    where: { id },
  })
}

/**
 * Get all students in a batch
 */
export async function getBatchStudents(batchId: string) {
  const students = await prisma.student.findMany({
    where: { batchId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      educationLevel: true,
      gradeLevel: true,
      dateOfBirth: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  return students
}

/**
 * Get the count of students in a batch
 */
export async function getBatchStudentCount(batchId: string) {
  const count = await prisma.student.count({
    where: { batchId },
  })

  return count
}

/**
 * Assign students to a batch (bulk update)
 */
export async function assignStudentsToBatch(
  batchId: string,
  studentIds: string[]
) {
  const result = await prisma.$transaction(async (tx) => {
    // Update all students
    await tx.student.updateMany({
      where: {
        id: { in: studentIds },
      },
      data: {
        batchId,
      },
    })

    // Verify the updates
    const updatedStudents = await tx.student.findMany({
      where: {
        id: { in: studentIds },
      },
      select: {
        id: true,
        name: true,
        batchId: true,
      },
    })

    const successfulAssignments = updatedStudents.filter(
      (s) => s.batchId === batchId
    )
    const failedAssignments = studentIds.filter(
      (id) => !successfulAssignments.some((s) => s.id === id)
    )

    return {
      success: true,
      assignedCount: successfulAssignments.length,
      failedAssignments: failedAssignments.length > 0 ? failedAssignments : [],
    }
  })

  return result
}

/**
 * Transfer students from one batch to another
 */
export async function transferStudents(
  fromBatchId: string,
  toBatchId: string,
  studentIds: string[]
) {
  const result = await prisma.$transaction(async (tx) => {
    // Verify students are in the source batch
    const studentsInSourceBatch = await tx.student.findMany({
      where: {
        id: { in: studentIds },
        batchId: fromBatchId,
      },
      select: { id: true },
    })

    const validStudentIds = studentsInSourceBatch.map((s) => s.id)
    const invalidStudentIds = studentIds.filter(
      (id) => !validStudentIds.includes(id)
    )

    if (validStudentIds.length === 0) {
      throw new Error('No valid students found in source batch')
    }

    // Transfer valid students
    await tx.student.updateMany({
      where: {
        id: { in: validStudentIds },
      },
      data: {
        batchId: toBatchId,
      },
    })

    return {
      success: true,
      transferredCount: validStudentIds.length,
      failedTransfers: invalidStudentIds.length > 0 ? invalidStudentIds : [],
    }
  })

  return result
}

/**
 * Get batch summary statistics
 */
export async function getBatchSummary() {
  const [totalBatches, totalStudents, batchesWithStudents] = await Promise.all([
    prisma.batch.count(),
    prisma.student.count(),
    prisma.batch.count({
      where: {
        Student: {
          some: {},
        },
      },
    }),
  ])

  return {
    totalBatches,
    totalStudents,
    activeBatches: batchesWithStudents,
    averageStudentsPerBatch:
      totalBatches > 0 ? Math.round(totalStudents / totalBatches) : 0,
  }
}

/**
 * Get batches with filters applied
 */
export async function getBatchesWithFilters(filters: {
  search?: string
  hasStudents?: boolean
  dateRange?: {
    from: Date
    to: Date
  }
}) {
  const where: Prisma.BatchWhereInput = {}

  if (filters.search) {
    where.name = {
      contains: filters.search,
      mode: 'insensitive',
    }
  }

  if (filters.hasStudents !== undefined) {
    if (filters.hasStudents) {
      where.Student = { some: {} }
    } else {
      where.Student = { none: {} }
    }
  }

  if (filters.dateRange) {
    where.createdAt = {
      gte: filters.dateRange.from,
      lte: filters.dateRange.to,
    }
  }

  const batches = await prisma.batch.findMany({
    where,
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
      Student: {
        where: {
          status: {
            not: 'withdrawn',
          },
        },
        select: { id: true },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return batches.map((batch) => ({
    id: batch.id,
    name: batch.name,
    startDate: batch.startDate,
    endDate: batch.endDate,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    studentCount: batch.Student.length,
  }))
}
