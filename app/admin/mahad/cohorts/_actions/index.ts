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

import { Prisma, $Enums } from '@prisma/client'

// Extract enum types for convenience
type EducationLevel = $Enums.EducationLevel
type GradeLevel = $Enums.GradeLevel
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { createBatch, deleteBatch, getBatchById } from '@/lib/db/queries/batch'
import {
  updateEnrollmentStatus,
  createEnrollment,
} from '@/lib/db/queries/enrollment'
import { getProgramProfileById } from '@/lib/db/queries/program-profile'
import { getPersonSiblings } from '@/lib/db/queries/siblings'
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

    let assignedCount = 0
    const failedAssignments: string[] = []

    for (const profileId of validated.studentIds) {
      try {
        const profile = await getProgramProfileById(profileId)
        if (!profile || profile.program !== 'MAHAD_PROGRAM') {
          failedAssignments.push(profileId)
          continue
        }

        // Get active enrollment or create new one
        const activeEnrollment = profile.enrollments?.find(
          (e) => e.status !== 'WITHDRAWN' && !e.endDate
        )

        if (activeEnrollment) {
          // Update existing enrollment
          await prisma.enrollment.update({
            where: { id: activeEnrollment.id },
            data: { batchId: validated.batchId },
          })
        } else {
          // Create new enrollment
          await createEnrollment({
            programProfileId: profileId,
            batchId: validated.batchId,
            status: 'ENROLLED',
          })
        }
        assignedCount++
      } catch (error) {
        console.error(`Failed to assign student ${profileId}:`, error)
        failedAssignments.push(profileId)
      }
    }

    revalidatePath('/admin/mahad/cohorts')
    revalidatePath(`/admin/mahad/cohorts/${validated.batchId}`)

    return {
      success: true,
      data: {
        assignedCount,
        failedAssignments,
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

    let transferredCount = 0
    const failedTransfers: string[] = []

    for (const profileId of validated.studentIds) {
      try {
        const profile = await getProgramProfileById(profileId)
        if (!profile || profile.program !== 'MAHAD_PROGRAM') {
          failedTransfers.push(profileId)
          continue
        }

        // Find enrollment in source batch
        const enrollment = profile.enrollments?.find(
          (e) =>
            e.batchId === validated.fromBatchId &&
            e.status !== 'WITHDRAWN' &&
            !e.endDate
        )

        if (enrollment) {
          // Update enrollment to new batch
          await prisma.enrollment.update({
            where: { id: enrollment.id },
            data: { batchId: validated.toBatchId },
          })
          transferredCount++
        } else {
          failedTransfers.push(profileId)
        }
      } catch (error) {
        console.error(`Failed to transfer student ${profileId}:`, error)
        failedTransfers.push(profileId)
      }
    }

    revalidatePath('/admin/mahad/cohorts')
    revalidatePath(`/admin/mahad/cohorts/${validated.fromBatchId}`)
    revalidatePath(`/admin/mahad/cohorts/${validated.toBatchId}`)

    return {
      success: true,
      data: {
        transferredCount,
        failedTransfers,
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
 * Get delete warnings for a student
 */
export async function getStudentDeleteWarningsAction(id: string) {
  try {
    const profile = await getProgramProfileById(id)
    if (!profile) {
      return {
        success: false,
        data: { hasSiblings: false, hasAttendanceRecords: false },
      } as const
    }

    // Check for siblings
    const siblings = await getPersonSiblings(profile.personId)
    const hasSiblings = siblings.length > 0

    return {
      success: true,
      data: { hasSiblings, hasAttendanceRecords: false }, // Attendance feature removed
    } as const
  } catch (error) {
    console.error('Failed to fetch delete warnings:', error)
    return {
      success: false,
      data: { hasSiblings: false, hasAttendanceRecords: false }, // Attendance feature removed
    } as const
  }
}

/**
 * Delete a single student
 */
export async function deleteStudentAction(id: string): Promise<ActionResult> {
  try {
    const profile = await getProgramProfileById(id)
    if (!profile || profile.program !== 'MAHAD_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Soft delete by withdrawing all enrollments
    const enrollments = profile.enrollments || []
    const batchIds = new Set<string>()

    for (const enrollment of enrollments) {
      if (enrollment.batchId) {
        batchIds.add(enrollment.batchId)
      }
      if (enrollment.status !== 'WITHDRAWN' && !enrollment.endDate) {
        await updateEnrollmentStatus(
          enrollment.id,
          'WITHDRAWN',
          'Deleted by admin'
        )
      }
    }

    // Update profile status
    await prisma.programProfile.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    })

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
        const profile = await getProgramProfileById(id)
        if (!profile || profile.program !== 'MAHAD_PROGRAM') {
          failedDeletes.push(id)
          continue
        }

        // Collect batch IDs
        const enrollments = profile.enrollments || []
        for (const enrollment of enrollments) {
          if (enrollment.batchId) {
            batchIdsToRevalidate.add(enrollment.batchId)
          }
          if (enrollment.status !== 'WITHDRAWN' && !enrollment.endDate) {
            await updateEnrollmentStatus(
              enrollment.id,
              'WITHDRAWN',
              'Bulk deleted by admin'
            )
          }
        }

        // Update profile status
        await prisma.programProfile.update({
          where: { id },
          data: { status: 'WITHDRAWN' },
        })

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

    // Get current profile to check if it exists
    const currentProfile = await getProgramProfileById(id)
    if (!currentProfile || currentProfile.program !== 'MAHAD_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Update person name if provided
    if (validated.name !== undefined) {
      await prisma.person.update({
        where: { id: currentProfile.personId },
        data: { name: validated.name },
      })
    }

    // Update person date of birth if provided
    if (validated.dateOfBirth !== undefined) {
      await prisma.person.update({
        where: { id: currentProfile.personId },
        data: { dateOfBirth: validated.dateOfBirth || null },
      })
    }

    // Update contact points if provided
    if (validated.email !== undefined || validated.phone !== undefined) {
      const person = currentProfile.person
      const contactPoints = person.contactPoints || []

      if (validated.email !== undefined) {
        const emailContact = contactPoints.find((cp) => cp.type === 'EMAIL')
        if (emailContact) {
          await prisma.contactPoint.update({
            where: { id: emailContact.id },
            data: { value: validated.email || '' },
          })
        } else if (validated.email) {
          await prisma.contactPoint.create({
            data: {
              personId: currentProfile.personId,
              type: 'EMAIL',
              value: validated.email,
            },
          })
        }
      }

      if (validated.phone !== undefined) {
        const phoneContact = contactPoints.find(
          (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
        )
        if (phoneContact) {
          await prisma.contactPoint.update({
            where: { id: phoneContact.id },
            data: { value: validated.phone || '' },
          })
        } else if (validated.phone) {
          await prisma.contactPoint.create({
            data: {
              personId: currentProfile.personId,
              type: 'PHONE',
              value: validated.phone,
            },
          })
        }
      }
    }

    // Update program profile fields
    const profileUpdates: Partial<{
      educationLevel: EducationLevel
      gradeLevel: GradeLevel
      schoolName: string | null
    }> = {}

    if (validated.educationLevel !== undefined) {
      profileUpdates.educationLevel = validated.educationLevel || null
    }
    if (validated.gradeLevel !== undefined) {
      profileUpdates.gradeLevel = validated.gradeLevel || null
    }
    if (validated.schoolName !== undefined) {
      profileUpdates.schoolName = validated.schoolName || null
    }

    if (Object.keys(profileUpdates).length > 0) {
      await prisma.programProfile.update({
        where: { id },
        data: profileUpdates,
      })
    }

    // Update batch assignment if provided
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
        // Create new enrollment if none exists
        await createEnrollment({
          programProfileId: id,
          batchId: validated.batchId,
          status: 'ENROLLED',
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
