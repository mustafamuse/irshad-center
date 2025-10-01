'use server'

/**
 * Assignment Server Actions
 *
 * Server-side mutations for student batch assignments and transfers.
 * All actions follow Next.js App Router best practices.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  assignStudentsToBatch,
  transferStudents,
  getBatchById,
} from '@/lib/db/queries/batch'
import { getStudentById, updateStudent } from '@/lib/db/queries/student'
import {
  BatchAssignmentSchema,
  BatchTransferSchema,
} from '@/lib/validations/batch'

// Type inference from schemas
type _BatchAssignmentInput = z.infer<typeof BatchAssignmentSchema>
type _BatchTransferInput = z.infer<typeof BatchTransferSchema>

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
 * Assign students to a batch
 *
 * @param batchId - Batch ID to assign students to
 * @param studentIds - Array of student IDs to assign
 * @returns ActionResult with assignment results or error
 */
export async function assignStudentsAction(
  batchId: string,
  studentIds: string[]
): Promise<
  ActionResult<{
    assignedCount: number
    failedAssignments: string[]
  }>
> {
  try {
    // Validate input
    const validated = BatchAssignmentSchema.parse({ batchId, studentIds })

    // Check if batch exists
    const batch = await getBatchById(validated.batchId)
    if (!batch) {
      return {
        success: false,
        error: 'Batch not found',
      }
    }

    // Execute database operation
    const result = await assignStudentsToBatch(
      validated.batchId,
      validated.studentIds
    )

    // Revalidate cache
    revalidatePath('/batches')
    revalidatePath(`/batches/${validated.batchId}`)

    // Return success
    return {
      success: true,
      data: {
        assignedCount: result.assignedCount,
        failedAssignments: result.failedAssignments,
      },
    }
  } catch (error) {
    // Handle errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.flatten().fieldErrors,
      }
    }

    console.error('[assignStudentsAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to assign students. Please try again.',
    }
  }
}

/**
 * Transfer students between batches
 *
 * @param fromBatchId - Source batch ID
 * @param toBatchId - Destination batch ID
 * @param studentIds - Array of student IDs to transfer
 * @returns ActionResult with transfer results or error
 */
export async function transferStudentsAction(
  fromBatchId: string,
  toBatchId: string,
  studentIds: string[]
): Promise<
  ActionResult<{
    transferredCount: number
    failedTransfers: string[]
  }>
> {
  try {
    // Validate input
    const validated = BatchTransferSchema.parse({
      fromBatchId,
      toBatchId,
      studentIds,
    })

    // Check if batches exist
    const [fromBatch, toBatch] = await Promise.all([
      getBatchById(validated.fromBatchId),
      getBatchById(validated.toBatchId),
    ])

    if (!fromBatch) {
      return {
        success: false,
        error: 'Source batch not found',
      }
    }

    if (!toBatch) {
      return {
        success: false,
        error: 'Destination batch not found',
      }
    }

    // Validate that source and destination are different
    if (validated.fromBatchId === validated.toBatchId) {
      return {
        success: false,
        error: 'Source and destination batches must be different',
      }
    }

    // Execute database operation
    const result = await transferStudents(
      validated.fromBatchId,
      validated.toBatchId,
      validated.studentIds
    )

    // Revalidate cache
    revalidatePath('/batches')
    revalidatePath(`/batches/${validated.fromBatchId}`)
    revalidatePath(`/batches/${validated.toBatchId}`)

    // Return success
    return {
      success: true,
      data: {
        transferredCount: result.transferredCount,
        failedTransfers: result.failedTransfers,
      },
    }
  } catch (error) {
    // Handle errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.flatten().fieldErrors,
      }
    }

    console.error('[transferStudentsAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to transfer students. Please try again.',
    }
  }
}

/**
 * Unassign students from their batch (set batchId to null)
 *
 * @param studentIds - Array of student IDs to unassign
 * @returns ActionResult with unassignment results or error
 */
export async function unassignStudentsAction(
  studentIds: string[]
): Promise<
  ActionResult<{
    unassignedCount: number
    failedUnassignments: string[]
  }>
> {
  try {
    // Validate input
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return {
        success: false,
        error: 'No students selected',
      }
    }

    // Validate each ID is a UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const invalidIds = studentIds.filter((id) => !uuidRegex.test(id))
    if (invalidIds.length > 0) {
      return {
        success: false,
        error: `Invalid student IDs: ${invalidIds.join(', ')}`,
      }
    }

    // Track batches for revalidation
    const batchIdsToRevalidate = new Set<string>()
    const failedUnassignments: string[] = []
    let unassignedCount = 0

    // Unassign each student
    for (const studentId of studentIds) {
      try {
        const student = await getStudentById(studentId)
        if (!student) {
          failedUnassignments.push(studentId)
          continue
        }

        // Track the old batch ID
        if (student.batchId) {
          batchIdsToRevalidate.add(student.batchId)
        }

        // Unassign the student
        await updateStudent(studentId, { batchId: null })
        unassignedCount++
      } catch (error) {
        console.error(
          `[unassignStudentsAction] Failed to unassign ${studentId}:`,
          error
        )
        failedUnassignments.push(studentId)
      }
    }

    // Revalidate cache
    revalidatePath('/batches')
    Array.from(batchIdsToRevalidate).forEach((batchId) => {
      revalidatePath(`/batches/${batchId}`)
    })

    // Return success (even if some failed)
    return {
      success: failedUnassignments.length === 0,
      data: {
        unassignedCount,
        failedUnassignments,
      },
      error:
        failedUnassignments.length > 0
          ? `Failed to unassign ${failedUnassignments.length} student(s)`
          : undefined,
    }
  } catch (error) {
    console.error('[unassignStudentsAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to unassign students. Please try again.',
    }
  }
}
