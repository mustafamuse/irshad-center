'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'

import { z } from 'zod'

import {
  getStudentById,
  resolveDuplicateStudents,
  getStudentDeleteWarnings,
} from '@/lib/db/queries/student'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { adminActionClient } from '@/lib/safe-action'
import {
  deleteStudentProfile,
  bulkDeleteStudentProfiles,
  updateStudentProfile,
} from '@/lib/services/mahad/student-mutation-service'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'
import { isPrismaError } from '@/lib/utils/type-guards'
import { UpdateStudentSchema } from '@/lib/validations/batch'

import type { BulkDeleteResult, DeleteWarnings } from '../_types'

// ============================================================================
// STUDENT ACTION SCHEMAS
// ============================================================================

const updateStudentInputSchema = UpdateStudentSchema.extend({
  id: z.string().uuid('Invalid student ID'),
})

const resolveDuplicatesInputSchema = z.object({
  keepId: z.string().uuid('Invalid student ID'),
  deleteIds: z
    .array(z.string().uuid('Invalid duplicate ID'))
    .min(1, 'No duplicate records selected for deletion'),
  mergeData: z.boolean().optional().default(false),
})

const studentIdInputSchema = z.object({
  id: z.string().uuid('Invalid student ID'),
})

const bulkDeleteInputSchema = z.object({
  studentIds: z
    .array(z.string().uuid('Invalid student ID'))
    .min(1, 'No students selected for deletion'),
})

// ============================================================================
// DUPLICATE RESOLUTION ACTIONS
// ============================================================================

const _resolveDuplicatesAction = adminActionClient
  .metadata({ actionName: 'resolveDuplicatesAction' })
  .schema(resolveDuplicatesInputSchema)
  .action(async ({ parsedInput }) => {
    const { keepId, deleteIds, mergeData } = parsedInput

    if (deleteIds.includes(keepId)) {
      throw new ActionError(
        'Cannot delete the record you want to keep',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    const [keepRecord, ...deleteRecords] = await Promise.all([
      getStudentById(keepId),
      ...deleteIds.map((id) => getStudentById(id)),
    ])

    if (!keepRecord) {
      throw new ActionError(
        'Student record to keep not found',
        ERROR_CODES.NOT_FOUND
      )
    }

    const missingRecords = deleteIds.filter((_, index) => !deleteRecords[index])
    if (missingRecords.length > 0) {
      throw new ActionError(
        'Some duplicate records could not be found',
        ERROR_CODES.NOT_FOUND
      )
    }

    try {
      await resolveDuplicateStudents(keepId, deleteIds, mergeData)
    } catch (error) {
      if (isPrismaError(error)) {
        if (error.code === 'P2025')
          throw new ActionError(
            'One or more student records not found',
            ERROR_CODES.NOT_FOUND
          )
        if (error.code === 'P2003')
          throw new ActionError(
            'Cannot resolve duplicates due to related records',
            ERROR_CODES.VALIDATION_ERROR
          )
      }
      throw error
    }

    after(() => {
      revalidateTag('mahad-stats')
      revalidateTag('mahad-students')
      revalidatePath('/admin/mahad')
    })
  })

export async function resolveDuplicatesAction(
  ...args: Parameters<typeof _resolveDuplicatesAction>
) {
  return _resolveDuplicatesAction(...args)
}

// ============================================================================
// STUDENT DELETION ACTIONS
// ============================================================================

const _getStudentDeleteWarningsAction = adminActionClient
  .metadata({ actionName: 'getStudentDeleteWarningsAction' })
  .schema(studentIdInputSchema)
  .action(async ({ parsedInput }): Promise<DeleteWarnings> => {
    const warnings = await getStudentDeleteWarnings(parsedInput.id)
    return warnings
  })

export async function getStudentDeleteWarningsAction(
  ...args: Parameters<typeof _getStudentDeleteWarningsAction>
) {
  return _getStudentDeleteWarningsAction(...args)
}

const _deleteStudentAction = adminActionClient
  .metadata({ actionName: 'deleteStudentAction' })
  .schema(studentIdInputSchema)
  .action(async ({ parsedInput }) => {
    const student = await getStudentById(parsedInput.id)
    if (!student) {
      throw new ActionError('Student not found', ERROR_CODES.NOT_FOUND)
    }

    // Best-effort guard under READ COMMITTED — not serializable, but
    // sufficient for admin-only tooling where concurrent subscription
    // creation targeting the same profile is operationally negligible.
    await deleteStudentProfile(parsedInput.id)

    after(() => {
      revalidateTag('mahad-stats')
      revalidateTag('mahad-students')
      revalidatePath('/admin/mahad')
    })
  })

export async function deleteStudentAction(
  ...args: Parameters<typeof _deleteStudentAction>
) {
  return _deleteStudentAction(...args)
}

const _bulkDeleteStudentsAction = adminActionClient
  .metadata({ actionName: 'bulkDeleteStudentsAction' })
  .schema(bulkDeleteInputSchema)
  .action(async ({ parsedInput }): Promise<BulkDeleteResult> => {
    const { studentIds } = parsedInput

    const { deletedCount, blockedIds } =
      await bulkDeleteStudentProfiles(studentIds)

    if (deletedCount > 0) {
      after(() => {
        revalidateTag('mahad-stats')
        revalidateTag('mahad-students')
        revalidatePath('/admin/mahad')
      })
    }

    return { deletedCount, blockedIds }
  })

export async function bulkDeleteStudentsAction(
  ...args: Parameters<typeof _bulkDeleteStudentsAction>
) {
  return _bulkDeleteStudentsAction(...args)
}

const _updateStudentAction = adminActionClient
  .metadata({ actionName: 'updateStudentAction' })
  .schema(updateStudentInputSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...data } = parsedInput
    const validated = UpdateStudentSchema.parse(data)

    const currentStudent = await getStudentById(id)
    if (!currentStudent) {
      throw new ActionError('Student not found', ERROR_CODES.NOT_FOUND)
    }

    const normalizedPhone = validated.phone
      ? normalizePhone(validated.phone)
      : undefined
    if (
      validated.phone !== undefined &&
      validated.phone !== '' &&
      !normalizedPhone
    ) {
      throw new ActionError(
        'Invalid phone number. Expected a 10-digit US number (e.g. 612-555-1234)',
        ERROR_CODES.VALIDATION_ERROR,
        'phone',
        400
      )
    }

    await updateStudentProfile(id, {
      name: validated.name,
      dateOfBirth:
        validated.dateOfBirth !== undefined
          ? validated.dateOfBirth || null
          : undefined,
      email:
        validated.email !== undefined
          ? normalizeEmail(validated.email)
          : undefined,
      phone:
        validated.phone !== undefined ? normalizedPhone || null : undefined,
      gradeLevel:
        validated.gradeLevel !== undefined
          ? validated.gradeLevel || null
          : undefined,
      schoolName:
        validated.schoolName !== undefined
          ? validated.schoolName || null
          : undefined,
      graduationStatus:
        validated.graduationStatus !== undefined
          ? validated.graduationStatus || null
          : undefined,
      paymentFrequency:
        validated.paymentFrequency !== undefined
          ? validated.paymentFrequency || null
          : undefined,
      billingType:
        validated.billingType !== undefined
          ? validated.billingType || null
          : undefined,
      paymentNotes:
        validated.paymentNotes !== undefined
          ? validated.paymentNotes || null
          : undefined,
      batchId:
        validated.batchId !== undefined ? validated.batchId || null : undefined,
    })

    after(() => {
      revalidateTag('mahad-stats')
      revalidateTag('mahad-students')
      revalidatePath('/admin/mahad')
    })
  })

export async function updateStudentAction(
  ...args: Parameters<typeof _updateStudentAction>
) {
  return _updateStudentAction(...args)
}
