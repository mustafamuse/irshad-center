'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'

import { z } from 'zod'

import {
  createBatch,
  deleteBatch,
  getBatchById,
  getBatchByName,
  updateBatch,
  assignStudentsToBatch,
  transferStudents,
} from '@/lib/db/queries/batch'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { adminActionClient } from '@/lib/safe-action'
import { isPrismaError } from '@/lib/utils/type-guards'
import {
  CreateBatchSchema,
  UpdateBatchSchema,
  BatchAssignmentSchema,
  BatchTransferSchema,
} from '@/lib/validations/batch'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type AssignmentResult = {
  assignedCount: number
  failedAssignments: string[]
}
type TransferResult = {
  transferredCount: number
  failedTransfers: string[]
}

// ============================================================================
// BATCH ACTION SCHEMAS
// ============================================================================

const createBatchInputSchema = z.object({
  name: z
    .string()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be less than 100 characters')
    .trim(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
})

const deleteBatchInputSchema = z.object({
  id: z.string().uuid('Invalid batch ID'),
})

const updateBatchInputSchema = z.object({
  id: z.string().uuid('Invalid batch ID'),
  name: z
    .string()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be less than 100 characters')
    .trim()
    .optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
})

// ============================================================================
// BATCH ACTIONS
// ============================================================================

const _createBatchAction = adminActionClient
  .metadata({ actionName: 'createBatchAction' })
  .schema(createBatchInputSchema)
  .action(async ({ parsedInput }) => {
    const validated = CreateBatchSchema.parse({
      name: parsedInput.name,
      startDate: parsedInput.startDate ?? undefined,
      endDate: parsedInput.endDate ?? undefined,
    })

    const existing = await getBatchByName(validated.name)
    if (existing) {
      throw new ActionError(
        `A cohort with the name "${validated.name}" already exists`,
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    let batch
    try {
      batch = await createBatch({
        name: validated.name,
        startDate: validated.startDate ?? null,
        endDate: validated.endDate ?? null,
      })
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2002') {
        throw new ActionError(
          `A cohort with the name "${validated.name}" already exists`,
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

    return batch
  })

export async function createBatchAction(
  ...args: Parameters<typeof _createBatchAction>
) {
  return _createBatchAction(...args)
}

const _deleteBatchAction = adminActionClient
  .metadata({ actionName: 'deleteBatchAction' })
  .schema(deleteBatchInputSchema)
  .action(async ({ parsedInput }) => {
    const batch = await getBatchById(parsedInput.id)
    if (!batch) {
      throw new ActionError('Cohort not found', ERROR_CODES.NOT_FOUND)
    }

    if (batch.studentCount > 0) {
      throw new ActionError(
        `Cannot delete cohort "${batch.name}": ${batch.studentCount} student${batch.studentCount > 1 ? 's' : ''} enrolled. Transfer them first.`,
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    try {
      await deleteBatch(parsedInput.id)
    } catch (error) {
      if (isPrismaError(error)) {
        if (error.code === 'P2025')
          throw new ActionError('Cohort not found', ERROR_CODES.NOT_FOUND)
        if (error.code === 'P2003')
          throw new ActionError(
            'Cannot delete cohort with related records',
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

export async function deleteBatchAction(
  ...args: Parameters<typeof _deleteBatchAction>
) {
  return _deleteBatchAction(...args)
}

const _updateBatchAction = adminActionClient
  .metadata({ actionName: 'updateBatchAction' })
  .schema(updateBatchInputSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...data } = parsedInput
    const validated = UpdateBatchSchema.parse(data)

    const existingBatch = await getBatchById(id)
    if (!existingBatch) {
      throw new ActionError('Cohort not found', ERROR_CODES.NOT_FOUND)
    }

    if (validated.name !== undefined) {
      const conflict = await getBatchByName(validated.name)
      if (conflict && conflict.id !== id) {
        throw new ActionError(
          `A cohort with the name "${validated.name}" already exists`,
          ERROR_CODES.VALIDATION_ERROR
        )
      }
    }

    try {
      const batch = await updateBatch(id, {
        name: validated.name,
        startDate: validated.startDate,
        endDate: validated.endDate,
      })

      after(() => {
        revalidateTag('mahad-stats')
        revalidateTag('mahad-students')
        revalidatePath('/admin/mahad')
      })

      return batch
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2002') {
        throw new ActionError(
          `A cohort with the name "${validated.name}" already exists`,
          ERROR_CODES.VALIDATION_ERROR
        )
      }
      if (isPrismaError(error) && error.code === 'P2025') {
        throw new ActionError('Cohort not found', ERROR_CODES.NOT_FOUND)
      }
      throw error
    }
  })

export async function updateBatchAction(
  ...args: Parameters<typeof _updateBatchAction>
) {
  return _updateBatchAction(...args)
}

// ============================================================================
// ASSIGNMENT ACTIONS
// ============================================================================

const _assignStudentsAction = adminActionClient
  .metadata({ actionName: 'assignStudentsAction' })
  .schema(BatchAssignmentSchema)
  .action(async ({ parsedInput }) => {
    const batch = await getBatchById(parsedInput.batchId)
    if (!batch) {
      throw new ActionError('Cohort not found', ERROR_CODES.NOT_FOUND)
    }

    try {
      const result = await assignStudentsToBatch(
        parsedInput.batchId,
        parsedInput.studentIds
      )

      after(() => {
        revalidateTag('mahad-stats')
        revalidateTag('mahad-students')
        revalidatePath('/admin/mahad')
      })

      return {
        assignedCount: result.assignedCount,
        failedAssignments: result.failedAssignments,
      } satisfies AssignmentResult
    } catch (error) {
      if (isPrismaError(error)) {
        if (error.code === 'P2003')
          throw new ActionError(
            'Invalid cohort or student reference',
            ERROR_CODES.VALIDATION_ERROR
          )
        if (error.code === 'P2025')
          throw new ActionError(
            'Cohort or student not found',
            ERROR_CODES.NOT_FOUND
          )
      }
      throw error
    }
  })

export async function assignStudentsAction(
  ...args: Parameters<typeof _assignStudentsAction>
) {
  return _assignStudentsAction(...args)
}

const _transferStudentsAction = adminActionClient
  .metadata({ actionName: 'transferStudentsAction' })
  .schema(BatchTransferSchema)
  .action(async ({ parsedInput }) => {
    const [fromBatch, toBatch] = await Promise.all([
      getBatchById(parsedInput.fromBatchId),
      getBatchById(parsedInput.toBatchId),
    ])

    if (!fromBatch) {
      throw new ActionError('Source cohort not found', ERROR_CODES.NOT_FOUND)
    }

    if (!toBatch) {
      throw new ActionError(
        'Destination cohort not found',
        ERROR_CODES.NOT_FOUND
      )
    }

    if (parsedInput.fromBatchId === parsedInput.toBatchId) {
      throw new ActionError(
        `Cannot transfer within the same cohort (${fromBatch.name})`,
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    try {
      const result = await transferStudents(
        parsedInput.fromBatchId,
        parsedInput.toBatchId,
        parsedInput.studentIds
      )

      if (result.transferredCount === 0) {
        throw new ActionError(
          result.errors[0] || 'No students were transferred',
          ERROR_CODES.VALIDATION_ERROR
        )
      }

      after(() => {
        revalidateTag('mahad-stats')
        revalidateTag('mahad-students')
        revalidatePath('/admin/mahad')
      })

      return {
        transferredCount: result.transferredCount,
        failedTransfers: result.failedTransfers,
      } satisfies TransferResult
    } catch (error) {
      if (error instanceof ActionError) throw error
      if (isPrismaError(error)) {
        if (error.code === 'P2003')
          throw new ActionError(
            'Invalid cohort or student reference',
            ERROR_CODES.VALIDATION_ERROR
          )
        if (error.code === 'P2025')
          throw new ActionError(
            'Cohort or student not found',
            ERROR_CODES.NOT_FOUND
          )
      }
      throw error
    }
  })

export async function transferStudentsAction(
  ...args: Parameters<typeof _transferStudentsAction>
) {
  return _transferStudentsAction(...args)
}
