'use server'

/**
 * Duplicate Resolution Server Actions
 *
 * Server-side mutations for resolving duplicate student records.
 * All actions follow Next.js App Router best practices.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  resolveDuplicateStudents,
  getStudentById,
} from '@/lib/db/queries/student'
import { ResolveDuplicatesSchema } from '@/lib/validations/batch'

// Type inference from schemas
type _ResolveDuplicatesInput = z.infer<typeof ResolveDuplicatesSchema>

/**
 * Action result type for consistent response structure
 */
type ActionResult<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  errors?: Partial<Record<string, string[]>>
}

/**
 * Resolve duplicate students by keeping one record and deleting others
 *
 * @param keepId - ID of the student record to keep
 * @param deleteIds - Array of student IDs to delete (duplicates)
 * @param mergeData - Whether to merge data from deleted records into kept record
 * @returns ActionResult indicating success or error
 */
export async function resolveDuplicatesAction(
  keepId: string,
  deleteIds: string[],
  mergeData: boolean = false
): Promise<ActionResult<void>> {
  try {
    // Validate input
    if (!keepId || typeof keepId !== 'string') {
      return {
        success: false,
        error: 'Invalid student ID to keep',
      }
    }

    if (!Array.isArray(deleteIds) || deleteIds.length === 0) {
      return {
        success: false,
        error: 'No duplicate records selected for deletion',
      }
    }

    // Validate UUIDs
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(keepId)) {
      return {
        success: false,
        error: 'Invalid student ID format',
      }
    }

    const invalidIds = deleteIds.filter((id) => !uuidRegex.test(id))
    if (invalidIds.length > 0) {
      return {
        success: false,
        error: `Invalid student ID format: ${invalidIds.join(', ')}`,
      }
    }

    // Ensure keepId is not in deleteIds
    if (deleteIds.includes(keepId)) {
      return {
        success: false,
        error: 'Cannot delete the record you want to keep',
      }
    }

    // Check if keep record exists
    const keepRecord = await getStudentById(keepId)
    if (!keepRecord) {
      return {
        success: false,
        error: 'Student record to keep not found',
      }
    }

    // Check if all delete records exist
    const deleteRecords = await Promise.all(
      deleteIds.map((id) => getStudentById(id))
    )
    const missingRecords = deleteIds.filter(
      (id, index) => !deleteRecords[index]
    )
    if (missingRecords.length > 0) {
      return {
        success: false,
        error: `Some duplicate records not found: ${missingRecords.join(', ')}`,
      }
    }

    // Track batches for revalidation
    const batchIdsToRevalidate = new Set<string>()
    if (keepRecord.batchId) {
      batchIdsToRevalidate.add(keepRecord.batchId)
    }
    deleteRecords.forEach((record) => {
      if (record?.batchId) {
        batchIdsToRevalidate.add(record.batchId)
      }
    })

    // Execute database operation
    await resolveDuplicateStudents(keepId, deleteIds, mergeData)

    // Revalidate cache
    revalidatePath('/batches')
    Array.from(batchIdsToRevalidate).forEach((batchId) => {
      revalidatePath(`/batches/${batchId}`)
    })

    // Return success
    return {
      success: true,
    }
  } catch (error) {
    console.error('[resolveDuplicatesAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to resolve duplicates. Please try again.',
    }
  }
}

/**
 * Batch resolve multiple duplicate groups
 *
 * @param duplicateGroups - Array of duplicate groups to resolve
 * @returns ActionResult with resolution results or error
 */
export async function batchResolveDuplicatesAction(
  duplicateGroups: Array<{
    keepId: string
    deleteIds: string[]
    mergeData?: boolean
  }>
): Promise<
  ActionResult<{
    resolvedCount: number
    failedGroups: Array<{ keepId: string; error: string }>
  }>
> {
  try {
    // Validate input
    if (!Array.isArray(duplicateGroups) || duplicateGroups.length === 0) {
      return {
        success: false,
        error: 'No duplicate groups provided',
      }
    }

    // Validate schema
    const validated = ResolveDuplicatesSchema.parse({ duplicateGroups })

    // Track results
    const failedGroups: Array<{ keepId: string; error: string }> = []
    let resolvedCount = 0

    // Resolve each group
    for (const group of validated.duplicateGroups) {
      try {
        await resolveDuplicateStudents(
          group.keepId,
          group.deleteIds,
          validated.mergeData
        )
        resolvedCount++
      } catch (error) {
        console.error(
          `[batchResolveDuplicatesAction] Failed to resolve group ${group.keepId}:`,
          error
        )
        failedGroups.push({
          keepId: group.keepId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Revalidate cache
    revalidatePath('/batches')

    // Return results
    return {
      success: failedGroups.length === 0,
      data: {
        resolvedCount,
        failedGroups,
      },
      error:
        failedGroups.length > 0
          ? `Failed to resolve ${failedGroups.length} duplicate group(s)`
          : undefined,
    }
  } catch (error) {
    // Handle errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.flatten().fieldErrors,
      }
    }

    console.error('[batchResolveDuplicatesAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to resolve duplicates. Please try again.',
    }
  }
}
