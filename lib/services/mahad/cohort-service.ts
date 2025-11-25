/**
 * Mahad Cohort Service
 *
 * Business logic for Mahad batch/cohort management operations.
 * Handles batch creation, deletion, and student listing.
 *
 * Responsibilities:
 * - Create batches (cohorts)
 * - Delete batches
 * - Get batch information
 * - Get students in a batch
 * - Manage batch lifecycle
 */

import { prisma } from '@/lib/db'
import {
  createBatch,
  deleteBatch,
  getBatchById,
  getBatches,
  getBatchStudents,
  getBatchStudentCount,
  getBatchesWithFilters,
} from '@/lib/db/queries/batch'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import {
  mapEnrollmentToMahadStudent as _mapEnrollmentToMahadStudent,
  mapEnrollmentsToMahadStudents as _mapEnrollmentsToMahadStudents,
  type MahadStudent,
} from '@/lib/mappers/mahad-mapper'

/**
 * Batch creation input
 */
export interface BatchCreateInput {
  name: string
  startDate: Date
  endDate?: Date | null
  isActive?: boolean
}

/**
 * Batch filter options
 */
export interface BatchFilterOptions {
  search?: string
  hasStudents?: boolean
  dateRange?: {
    from: Date
    to: Date
  }
}

/**
 * Create a new batch (cohort).
 *
 * @param input - Batch creation data
 * @returns Created batch
 */
export async function createMahadBatch(input: BatchCreateInput) {
  // Validate dates
  if (input.endDate && input.startDate >= input.endDate) {
    throw new ActionError(
      'End date must be after start date',
      ERROR_CODES.VALIDATION_ERROR,
      'endDate',
      400
    )
  }

  return await createBatch({
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
  })
}

/**
 * Delete a batch.
 *
 * Only allows deletion if batch has no enrolled students.
 *
 * @param batchId - Batch ID
 * @returns Deleted batch
 * @throws Error if batch has students
 */
export async function deleteMahadBatch(batchId: string) {
  // Check if batch has students
  const studentCount = await getBatchStudentCount(batchId)

  if (studentCount > 0) {
    throw new ActionError(
      `Cannot delete batch with ${studentCount} enrolled student(s). Withdraw students first.`,
      ERROR_CODES.VALIDATION_ERROR,
      undefined,
      400
    )
  }

  return await deleteBatch(batchId)
}

/**
 * Get batch by ID.
 *
 * @param batchId - Batch ID
 * @returns Batch or null
 */
export async function getMahadBatch(batchId: string) {
  return await getBatchById(batchId)
}

/**
 * Get all batches.
 *
 * @returns Array of batches ordered by start date (descending)
 */
export async function getAllMahadBatches() {
  return await getBatches()
}

/**
 * Get batches with filters.
 *
 * @param filters - Filter options
 * @returns Filtered batches
 */
export async function getMahadBatchesWithFilters(filters: BatchFilterOptions) {
  return await getBatchesWithFilters(filters)
}

/**
 * Get students in a batch.
 *
 * Returns students with enrollment and subscription information.
 * Uses mapper to transform to UI-friendly format.
 *
 * @param batchId - Batch ID
 * @returns Array of MahadStudent DTOs
 */
export async function getMahadBatchStudents(
  batchId: string
): Promise<MahadStudent[]> {
  return await getBatchStudents(batchId)
}

/**
 * Get student count for a batch.
 *
 * @param batchId - Batch ID
 * @returns Number of active students in batch
 */
export async function getMahadBatchStudentCount(batchId: string) {
  return await getBatchStudentCount(batchId)
}

/**
 * Update batch information.
 *
 * @param batchId - Batch ID
 * @param data - Batch update data
 * @returns Updated batch
 */
export async function updateMahadBatch(
  batchId: string,
  data: {
    name?: string
    startDate?: Date
    endDate?: Date | null
    isActive?: boolean
  }
) {
  // Validate dates if provided
  if (data.startDate && data.endDate && data.startDate >= data.endDate) {
    throw new ActionError(
      'End date must be after start date',
      ERROR_CODES.VALIDATION_ERROR,
      'endDate',
      400
    )
  }

  return await prisma.batch.update({
    where: { id: batchId },
    data,
  })
}

/**
 * Activate a batch.
 *
 * @param batchId - Batch ID
 * @returns Updated batch
 */
export async function activateMahadBatch(batchId: string) {
  return await updateMahadBatch(batchId, { isActive: true })
}

/**
 * Deactivate a batch.
 *
 * @param batchId - Batch ID
 * @returns Updated batch
 */
export async function deactivateMahadBatch(batchId: string) {
  return await updateMahadBatch(batchId, { isActive: false })
}
