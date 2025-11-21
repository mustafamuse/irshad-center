// ⚠️ CRITICAL MIGRATION NEEDED: This file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model

/**
 * Batch Query Functions
 *
 * Direct Prisma queries for batch operations following Next.js App Router best practices.
 * These functions replace the Repository/Service pattern with simple, composable query functions.
 *
 * Uses React cache() to deduplicate requests across parallel route slots.
 */

import { cache } from 'react'

import { prisma } from '@/lib/db'

// TODO: All functions in this file have been stubbed to return empty/null values
// Full migration to ProgramProfile/Enrollment model is required

/**
 * Get all batches with student count (excluding withdrawn students)
 *
 * Uses React cache() to deduplicate requests. When called multiple times
 * in the same request (e.g., from different parallel route slots), only
 * one database query executes.
 */
export const getBatches = cache(async function getBatches() {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
})

/**
 * Get a single batch by ID (excluding withdrawn students from count)
 */
export async function getBatchById(id: string): Promise<{
  id: string
  name: string
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
  updatedAt: Date
  studentCount: number
} | null> {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  const batch = await prisma.batch.findUnique({
    where: { id },
  })

  if (!batch) return null

  // Return batch with studentCount set to 0 (Student model removed)
  return {
    ...batch,
    studentCount: 0, // TODO: Calculate from ProgramProfile/Enrollment when migrated
  }
}

/**
 * Check if a batch with the given name exists (case-insensitive)
 */
export async function getBatchByName(_name: string) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return null // Temporary: return null until migration complete
}

/**
 * Create a new batch (student count excludes withdrawn)
 */
export async function createBatch(_data: {
  name: string
  startDate?: Date | null
}) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed')
}

/**
 * Update a batch (student count excludes withdrawn)
 */
export async function updateBatch(
  _id: string,
  _data: {
    name?: string
    startDate?: Date | null
    endDate?: Date | null
  }
) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed')
}

/**
 * Delete a batch
 */
export async function deleteBatch(_id: string) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed')
}

/**
 * Get all students in a batch
 */
export async function getBatchStudents(_batchId: string) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}

/**
 * Get the count of students in a batch
 */
export async function getBatchStudentCount(_batchId: string) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return 0 // Temporary: return 0 until migration complete
}

/**
 * Assign students to a batch (bulk update)
 */
export async function assignStudentsToBatch(
  batchId: string,
  studentIds: string[]
) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return {
    success: false,
    assignedCount: 0,
    failedAssignments: studentIds,
  } // Temporary: return failure until migration complete
}

/**
 * Transfer students from one batch to another
 */
export async function transferStudents(
  fromBatchId: string,
  toBatchId: string,
  studentIds: string[]
) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return {
    success: false,
    transferredCount: 0,
    failedTransfers: studentIds,
  } // Temporary: return failure until migration complete
}

/**
 * Get batch summary statistics
 */
export async function getBatchSummary() {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return {
    totalBatches: 0,
    totalStudents: 0,
    activeBatches: 0,
    averageStudentsPerBatch: 0,
  } // Temporary: return zeros until migration complete
}

/**
 * Get batches with filters applied
 */
export async function getBatchesWithFilters(_filters: {
  search?: string
  hasStudents?: boolean
  dateRange?: {
    from: Date
    to: Date
  }
}) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}
