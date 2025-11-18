'use server'

/**
 * Batch Management Server Actions
 *
 * Server-side mutations for batch and student operations.
 * Only includes actively used actions - dead code removed.
 *
 * Uses Prisma-generated types and error codes for better type safety.
 */

import { revalidatePath } from 'next/cache'

import { Prisma } from '@prisma/client'
import { z } from 'zod'

import {
  createBatch,
  deleteBatch,
  getBatchById,
  assignStudentsToBatch,
  transferStudents,
} from '@/lib/db/queries/batch'
import {
  getStudentById,
  resolveDuplicateStudents,
  deleteStudent,
  getStudentDeleteWarnings,
  updateStudent,
} from '@/lib/db/queries/student'
import {
  CreateBatchSchema,
  BatchAssignmentSchema,
  BatchTransferSchema,
  UpdateStudentSchema,
} from '@/lib/validations/batch'

import type { UpdateStudentPayload } from '../_types/student-form'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Action result type for consistent response structure
 */
type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  errors?: Partial<Record<string, string[]>>
}

/**
 * Type aliases for cleaner function signatures
 */
type BatchData = Awaited<ReturnType<typeof createBatch>>
type AssignmentResult = {
  assignedCount: number
  failedAssignments: string[]
}
type TransferResult = {
  transferredCount: number
  failedTransfers: string[]
}

// ============================================================================
// PRISMA ERROR HANDLING
// ============================================================================

/**
 * Prisma error code constants
 */
const PRISMA_ERRORS = {
  UNIQUE_CONSTRAINT: 'P2002',
  RECORD_NOT_FOUND: 'P2025',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
} as const

/**
 * Check if error is a Prisma error
 */
function isPrismaError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
}

/**
 * Centralized error handler for all actions
 */
function handleActionError<T = void>(
  error: unknown,
  action: string,
  context?: { name?: string; handlers?: Record<string, string> }
): ActionResult<T> {
  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return {
      success: false,
      errors: error.flatten().fieldErrors,
    }
  }

  // Log error with context for debugging
  console.error(`[${action}] Error:`, error)

  // Handle Prisma-specific errors with custom messages
  if (isPrismaError(error) && context?.handlers?.[error.code]) {
    return {
      success: false,
      error: context.handlers[error.code],
    }
  }

  // Default generic error message
  return {
    success: false,
    error: error instanceof Error ? error.message : `Failed to ${action}`,
  }
}

// ============================================================================
// BATCH ACTIONS
// ============================================================================

/**
 * Create a new batch
 */
export async function createBatchAction(
  formData: FormData
): Promise<ActionResult<BatchData>> {
  const rawData = {
    name: formData.get('name'),
    startDate: formData.get('startDate')
      ? new Date(formData.get('startDate') as string)
      : undefined,
  }

  try {
    const validated = CreateBatchSchema.parse(rawData)

    // Let Prisma handle uniqueness constraint - no race condition
    const batch = await createBatch({
      name: validated.name,
      startDate: validated.startDate ?? null,
    })

    revalidatePath('/admin/mahad/cohorts')

    return {
      success: true,
      data: batch,
    }
  } catch (error) {
    return handleActionError(error, 'createBatchAction', {
      handlers: {
        [PRISMA_ERRORS.UNIQUE_CONSTRAINT]: `A cohort with the name "${String(rawData.name)}" already exists`,
      },
    })
  }
}

/**
 * Delete a batch with safety checks
 */
export async function deleteBatchAction(id: string): Promise<ActionResult> {
  try {
    const batch = await getBatchById(id)
    if (!batch) {
      return {
        success: false,
        error: 'Cohort not found',
      }
    }

    // Use studentCount from existing batch query - no extra query needed
    if (batch.studentCount > 0) {
      return {
        success: false,
        error: `Cannot delete cohort "${batch.name}": ${batch.studentCount} student${batch.studentCount > 1 ? 's' : ''} enrolled. Transfer them first.`,
      }
    }

    await deleteBatch(id)
    revalidatePath('/admin/mahad/cohorts')

    return {
      success: true,
    }
  } catch (error) {
    return handleActionError(error, 'deleteBatchAction', {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Cohort not found',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Cannot delete cohort with related records',
      },
    })
  }
}

// ============================================================================
// ASSIGNMENT ACTIONS
// ============================================================================

/**
 * Assign students to a batch
 */
export async function assignStudentsAction(
  batchId: string,
  studentIds: string[]
): Promise<ActionResult<AssignmentResult>> {
  try {
    const validated = BatchAssignmentSchema.parse({ batchId, studentIds })

    const batch = await getBatchById(validated.batchId)
    if (!batch) {
      return {
        success: false,
        error: 'Cohort not found',
      }
    }

    const result = await assignStudentsToBatch(
      validated.batchId,
      validated.studentIds
    )

    revalidatePath('/admin/mahad/cohorts')
    revalidatePath(`/admin/mahad/cohorts/${validated.batchId}`)

    return {
      success: true,
      data: {
        assignedCount: result.assignedCount,
        failedAssignments: result.failedAssignments,
      },
    }
  } catch (error) {
    return handleActionError(error, 'assignStudentsAction', {
      handlers: {
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Invalid cohort or student reference',
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Cohort or student not found',
      },
    })
  }
}

/**
 * Transfer students between batches
 */
export async function transferStudentsAction(
  fromBatchId: string,
  toBatchId: string,
  studentIds: string[]
): Promise<ActionResult<TransferResult>> {
  try {
    const validated = BatchTransferSchema.parse({
      fromBatchId,
      toBatchId,
      studentIds,
    })

    const [fromBatch, toBatch] = await Promise.all([
      getBatchById(validated.fromBatchId),
      getBatchById(validated.toBatchId),
    ])

    if (!fromBatch) {
      return {
        success: false,
        error: 'Source cohort not found',
      }
    }

    if (!toBatch) {
      return {
        success: false,
        error: 'Destination cohort not found',
      }
    }

    if (validated.fromBatchId === validated.toBatchId) {
      return {
        success: false,
        error: `Cannot transfer within the same cohort (${fromBatch.name})`,
      }
    }

    const result = await transferStudents(
      validated.fromBatchId,
      validated.toBatchId,
      validated.studentIds
    )

    revalidatePath('/admin/mahad/cohorts')
    revalidatePath(`/admin/mahad/cohorts/${validated.fromBatchId}`)
    revalidatePath(`/admin/mahad/cohorts/${validated.toBatchId}`)

    return {
      success: true,
      data: {
        transferredCount: result.transferredCount,
        failedTransfers: result.failedTransfers,
      },
    }
  } catch (error) {
    return handleActionError(error, 'transferStudentsAction', {
      handlers: {
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Invalid cohort or student reference',
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Cohort or student not found',
      },
    })
  }
}

// ============================================================================
// DUPLICATE RESOLUTION ACTIONS
// ============================================================================

/**
 * Resolve duplicate students
 */
export async function resolveDuplicatesAction(
  keepId: string,
  deleteIds: string[],
  mergeData: boolean = false
): Promise<ActionResult> {
  try {
    // Business logic validation only - Prisma handles UUID format
    if (!Array.isArray(deleteIds) || deleteIds.length === 0) {
      return {
        success: false,
        error: 'No duplicate records selected for deletion',
      }
    }

    if (deleteIds.includes(keepId)) {
      return {
        success: false,
        error: 'Cannot delete the record you want to keep',
      }
    }

    // Fetch all records in parallel - more efficient
    const [keepRecord, ...deleteRecords] = await Promise.all([
      getStudentById(keepId),
      ...deleteIds.map((id) => getStudentById(id)),
    ])

    if (!keepRecord) {
      return {
        success: false,
        error: 'Student record to keep not found',
      }
    }

    const missingRecords = deleteIds.filter(
      (id, index) => !deleteRecords[index]
    )
    if (missingRecords.length > 0) {
      return {
        success: false,
        error: `Some duplicate records not found: ${missingRecords.join(', ')}`,
      }
    }

    // Functional approach to collect batch IDs
    const batchIdsToRevalidate = new Set(
      [keepRecord.batchId, ...deleteRecords.map((r) => r?.batchId)].filter(
        (id): id is string => Boolean(id)
      )
    )

    await resolveDuplicateStudents(keepId, deleteIds, mergeData)

    revalidatePath('/admin/mahad/cohorts')
    Array.from(batchIdsToRevalidate).forEach((batchId) => {
      revalidatePath(`/admin/mahad/cohorts/${batchId}`)
    })

    return {
      success: true,
    }
  } catch (error) {
    return handleActionError(error, 'resolveDuplicatesAction', {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]:
          'One or more student records not found',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Cannot resolve duplicates due to related records',
      },
    })
  }
}

// ============================================================================
// STUDENT DELETION ACTIONS
// ============================================================================

/**
 * Get delete warnings for a student
 */
export async function getStudentDeleteWarningsAction(id: string) {
  try {
    const warnings = await getStudentDeleteWarnings(id)
    return { success: true, data: warnings } as const
  } catch (error) {
    console.error('Failed to fetch delete warnings:', error)
    return {
      success: false,
      data: { hasSiblings: false, hasAttendanceRecords: false },
    } as const
  }
}

/**
 * Delete a single student
 */
export async function deleteStudentAction(id: string): Promise<ActionResult> {
  try {
    const student = await getStudentById(id)
    if (!student) {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Delete the student
    await deleteStudent(id)

    revalidatePath('/admin/mahad/cohorts')
    if (student.batchId) {
      revalidatePath(`/admin/mahad/cohorts/${student.batchId}`)
    }

    return {
      success: true,
    }
  } catch (error) {
    return handleActionError(error, 'deleteStudentAction', {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Student not found',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Cannot delete student with related records',
      },
    })
  }
}

/**
 * Bulk delete students
 */
export async function bulkDeleteStudentsAction(
  studentIds: string[]
): Promise<ActionResult<{ deletedCount: number; failedDeletes: string[] }>> {
  try {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return { success: false, error: 'No students selected for deletion' }
    }

    let deletedCount = 0
    const failedDeletes: string[] = []
    const batchIdsToRevalidate = new Set<string>()

    for (const id of studentIds) {
      try {
        const student = await getStudentById(id)
        if (student?.batchId) {
          batchIdsToRevalidate.add(student.batchId)
        }
        await deleteStudent(id)
        deletedCount++
      } catch (error) {
        console.error(`Failed to delete student ${id}:`, error)
        failedDeletes.push(id)
      }
    }

    revalidatePath('/admin/mahad/cohorts')
    Array.from(batchIdsToRevalidate).forEach((batchId) => {
      revalidatePath(`/admin/mahad/cohorts/${batchId}`)
    })

    return {
      success: true,
      data: { deletedCount, failedDeletes },
    }
  } catch (error) {
    return handleActionError(error, 'bulkDeleteStudentsAction')
  }
}

/**
 * Update a student
 */
export async function updateStudentAction(
  id: string,
  data: UpdateStudentPayload
): Promise<ActionResult> {
  try {
    // Validate input data
    const validated = UpdateStudentSchema.parse(data)

    // Get current student to check if it exists
    const currentStudent = await getStudentById(id)
    if (!currentStudent) {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Update the student
    await updateStudent(id, {
      ...(validated.name !== undefined && { name: validated.name }),
      ...(validated.email !== undefined && { email: validated.email || null }),
      ...(validated.phone !== undefined && { phone: validated.phone || null }),
      ...(validated.dateOfBirth !== undefined && {
        dateOfBirth: validated.dateOfBirth || null,
      }),
      ...(validated.educationLevel !== undefined && {
        educationLevel: validated.educationLevel || null,
      }),
      ...(validated.gradeLevel !== undefined && {
        gradeLevel: validated.gradeLevel || null,
      }),
      ...(validated.schoolName !== undefined && {
        schoolName: validated.schoolName || null,
      }),
      ...(validated.monthlyRate !== undefined && {
        monthlyRate: validated.monthlyRate,
      }),
      ...(validated.customRate !== undefined && {
        customRate: validated.customRate,
      }),
      ...(validated.batchId !== undefined && {
        batchId: validated.batchId || null,
      }),
    })

    // Revalidate all relevant paths
    revalidatePath('/admin/mahad/cohorts')
    // Revalidate the student detail page (both modal and full page)
    revalidatePath(`/admin/mahad/cohorts/students/${id}`)

    if (currentStudent.batchId) {
      revalidatePath(`/admin/mahad/cohorts/${currentStudent.batchId}`)
    }
    if (validated.batchId && validated.batchId !== currentStudent.batchId) {
      revalidatePath(`/admin/mahad/cohorts/${validated.batchId}`)
    }

    return {
      success: true,
    }
  } catch (error) {
    return handleActionError(error, 'updateStudentAction', {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Student not found',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Invalid batch or related record reference',
      },
    })
  }
}
