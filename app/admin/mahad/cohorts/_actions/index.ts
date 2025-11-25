'use server'

/**
 * Batch Management Server Actions
 *
 * Server-side mutations for batch and student operations.
 * Refactored to use Mahad services for DRY architecture.
 *
 * Uses Prisma-generated types and error codes for better type safety.
 */

import { revalidatePath } from 'next/cache'

import {
  Prisma,
  EducationLevel as _EducationLevel,
  GradeLevel as _GradeLevel,
} from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { getBatchById } from '@/lib/db/queries/batch'
import { updateEnrollmentStatus } from '@/lib/db/queries/enrollment'
import { getProgramProfileById } from '@/lib/db/queries/program-profile'
import { createActionLogger } from '@/lib/logger'
import {
  createMahadBatch,
  deleteMahadBatch,
} from '@/lib/services/mahad/cohort-service'
import {
  assignStudentsToBatch,
  transferStudentsToBatch,
} from '@/lib/services/mahad/enrollment-service'
import {
  updateMahadStudent,
  getMahadStudentSiblings,
  deleteMahadStudent,
} from '@/lib/services/mahad/student-service'
import {
  CreateBatchSchema,
  BatchAssignmentSchema,
  BatchTransferSchema,
  UpdateStudentSchema,
} from '@/lib/validations/batch'

import type { UpdateStudentPayload } from '../_types/student-form'

const logger = createActionLogger('cohorts-actions')

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
type BatchData = Awaited<ReturnType<typeof createMahadBatch>>
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
  logger.error(
    {
      err: error instanceof Error ? error : new Error(String(error)),
      action,
    },
    'Action error'
  )

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
 * Create a new batch using Mahad service
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

    const batch = await createMahadBatch({
      name: validated.name,
      startDate: validated.startDate ?? new Date(),
      isActive: true,
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
 * Delete a batch using Mahad service (with safety checks)
 */
export async function deleteBatchAction(id: string): Promise<ActionResult> {
  try {
    await deleteMahadBatch(id)
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
 * Assign students to a batch using Mahad service
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
      data: result,
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
 * Transfer students between batches using Mahad service
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

    const result = await transferStudentsToBatch(
      validated.studentIds,
      validated.toBatchId
    )

    revalidatePath('/admin/mahad/cohorts')
    revalidatePath(`/admin/mahad/cohorts/${validated.fromBatchId}`)
    revalidatePath(`/admin/mahad/cohorts/${validated.toBatchId}`)

    return {
      success: true,
      data: result,
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
  _mergeData: boolean = false
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
      getProgramProfileById(keepId),
      ...deleteIds.map((id) => getProgramProfileById(id)),
    ])

    if (!keepRecord || keepRecord.program !== 'MAHAD_PROGRAM') {
      return {
        success: false,
        error: 'Student record to keep not found',
      }
    }

    const missingRecords = deleteIds.filter(
      (id, index) =>
        !deleteRecords[index] ||
        deleteRecords[index]?.program !== 'MAHAD_PROGRAM'
    )
    if (missingRecords.length > 0) {
      return {
        success: false,
        error: `Some duplicate records not found: ${missingRecords.join(', ')}`,
      }
    }

    // Collect batch IDs for revalidation
    const batchIdsToRevalidate = new Set<string>()
    const keepEnrollment = keepRecord.enrollments?.find(
      (e) => e.status !== 'WITHDRAWN' && !e.endDate
    )
    if (keepEnrollment?.batchId) {
      batchIdsToRevalidate.add(keepEnrollment.batchId)
    }

    // Soft delete duplicate profiles by withdrawing enrollments
    for (const deleteRecord of deleteRecords) {
      if (!deleteRecord || deleteRecord.program !== 'MAHAD_PROGRAM') continue

      const deleteEnrollment = deleteRecord.enrollments?.find(
        (e) => e.status !== 'WITHDRAWN' && !e.endDate
      )
      if (deleteEnrollment?.batchId) {
        batchIdsToRevalidate.add(deleteEnrollment.batchId)
      }

      // Withdraw all enrollments
      for (const enrollment of deleteRecord.enrollments || []) {
        if (enrollment.status !== 'WITHDRAWN' && !enrollment.endDate) {
          await updateEnrollmentStatus(
            enrollment.id,
            'WITHDRAWN',
            'Duplicate resolved'
          )
        }
      }

      // Deactivate billing assignments to prevent orphaned subscriptions
      await prisma.billingAssignment.updateMany({
        where: {
          programProfileId: deleteRecord.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })

      // Update profile status
      await prisma.programProfile.update({
        where: { id: deleteRecord.id },
        data: { status: 'WITHDRAWN' },
      })
    }

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
 * Get delete warnings for a student using Mahad service
 */
export async function getStudentDeleteWarningsAction(id: string) {
  try {
    const siblings = await getMahadStudentSiblings(id)
    const hasSiblings = siblings.length > 0

    return {
      success: true,
      data: { hasSiblings, hasAttendanceRecords: false },
    } as const
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Failed to fetch delete warnings'
    )
    return {
      success: false,
      data: { hasSiblings: false, hasAttendanceRecords: false },
    } as const
  }
}

/**
 * Delete a single student using Mahad service
 */
export async function deleteStudentAction(id: string): Promise<ActionResult> {
  try {
    // Get profile to determine which batches to revalidate
    const profile = await getProgramProfileById(id)
    if (!profile || profile.program !== 'MAHAD_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    const batchIds = new Set<string>()
    const enrollments = profile.enrollments || []
    for (const enrollment of enrollments) {
      if (enrollment.batchId) {
        batchIds.add(enrollment.batchId)
      }
    }

    // Use service to delete student
    await deleteMahadStudent(id)

    revalidatePath('/admin/mahad/cohorts')
    Array.from(batchIds).forEach((batchId) => {
      revalidatePath(`/admin/mahad/cohorts/${batchId}`)
    })

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
 * Bulk delete students using Mahad service
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
        const profile = await getProgramProfileById(id)
        if (!profile || profile.program !== 'MAHAD_PROGRAM') {
          failedDeletes.push(id)
          continue
        }

        // Collect batch IDs for revalidation
        const enrollments = profile.enrollments || []
        for (const enrollment of enrollments) {
          if (enrollment.batchId) {
            batchIdsToRevalidate.add(enrollment.batchId)
          }
        }

        // Use service to delete student
        await deleteMahadStudent(id)
        deletedCount++
      } catch (error) {
        logger.error(
          {
            err: error instanceof Error ? error : new Error(String(error)),
            studentId: id,
          },
          'Failed to delete student'
        )
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
 * Update a student using Mahad service
 */
export async function updateStudentAction(
  id: string,
  data: UpdateStudentPayload
): Promise<ActionResult> {
  try {
    // Validate input data
    const validated = UpdateStudentSchema.parse(data)

    // Get current profile to check batch changes
    const currentProfile = await getProgramProfileById(id)
    if (!currentProfile || currentProfile.program !== 'MAHAD_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Use service to update student (handles person, contact points, and profile)
    await updateMahadStudent(id, {
      name: validated.name,
      email: validated.email,
      phone: validated.phone,
      dateOfBirth: validated.dateOfBirth,
      educationLevel: validated.educationLevel,
      gradeLevel: validated.gradeLevel,
      schoolName: validated.schoolName,
    })

    // Handle batch assignment separately (enrollment management)
    if (validated.batchId !== undefined) {
      const activeEnrollment = currentProfile.enrollments?.find(
        (e) => e.status !== 'WITHDRAWN' && !e.endDate
      )

      if (activeEnrollment) {
        await prisma.enrollment.update({
          where: { id: activeEnrollment.id },
          data: { batchId: validated.batchId || null },
        })
      } else if (validated.batchId) {
        await prisma.enrollment.create({
          data: {
            programProfileId: id,
            batchId: validated.batchId,
            status: 'ENROLLED',
            startDate: new Date(),
          },
        })
      }
    }

    // Revalidate all relevant paths
    revalidatePath('/admin/mahad/cohorts')
    revalidatePath(`/admin/mahad/cohorts/students/${id}`)

    const currentBatchId = currentProfile.enrollments?.find(
      (e) => e.status !== 'WITHDRAWN' && !e.endDate
    )?.batchId
    if (currentBatchId) {
      revalidatePath(`/admin/mahad/cohorts/${currentBatchId}`)
    }
    if (validated.batchId && validated.batchId !== currentBatchId) {
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
