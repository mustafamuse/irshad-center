'use server'

/**
 * Batch Server Actions
 *
 * Server-side mutations for batch operations with Zod validation.
 * All actions follow Next.js App Router best practices.
 */

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import {
  createBatch,
  updateBatch,
  deleteBatch,
  getBatchById,
  getBatchByName,
  getBatchStudentCount,
} from '@/lib/db/queries/batch'
import {
  CreateBatchSchema,
  UpdateBatchSchema,
} from '@/lib/validations/batch'

// Type inference from schemas
type _CreateBatchInput = z.infer<typeof CreateBatchSchema>
type _UpdateBatchInput = z.infer<typeof UpdateBatchSchema>

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
 * Create a new batch
 *
 * @param formData - FormData containing batch information
 * @returns ActionResult with created batch or error
 */
export async function createBatchAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    // Parse form data
    const rawData = {
      name: formData.get('name'),
      startDate: formData.get('startDate')
        ? new Date(formData.get('startDate') as string)
        : undefined,
    }

    // Validate with Zod
    const validated = CreateBatchSchema.parse(rawData)

    // Check for duplicate batch name
    const existingBatch = await getBatchByName(validated.name)
    if (existingBatch) {
      return {
        success: false,
        error: `A batch with the name "${validated.name}" already exists`,
      }
    }

    // Execute database operation
    const batch = await createBatch({
      name: validated.name,
      startDate: validated.startDate || null,
    })

    // Revalidate cache
    revalidatePath('/batches')

    // Return success
    return {
      success: true,
      data: batch,
    }
  } catch (error) {
    // Handle errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.flatten().fieldErrors,
      }
    }

    console.error('[createBatchAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create batch. Please try again.',
    }
  }
}

/**
 * Update an existing batch
 *
 * @param id - Batch ID to update
 * @param formData - FormData containing updated batch information
 * @returns ActionResult with updated batch or error
 */
export async function updateBatchAction(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    // Validate ID
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'Invalid batch ID',
      }
    }

    // Check if batch exists
    const existingBatch = await getBatchById(id)
    if (!existingBatch) {
      return {
        success: false,
        error: 'Batch not found',
      }
    }

    // Parse form data
    const rawData: Partial<UpdateBatchInput> = {}

    const name = formData.get('name')
    if (name !== null && name !== '') {
      rawData.name = name as string
    }

    const startDate = formData.get('startDate')
    if (startDate !== null && startDate !== '') {
      rawData.startDate = new Date(startDate as string)
    }

    const endDate = formData.get('endDate')
    if (endDate !== null && endDate !== '') {
      rawData.endDate = new Date(endDate as string)
    }

    // Validate with Zod
    const validated = UpdateBatchSchema.parse(rawData)

    // Check for duplicate name (if changing name)
    if (validated.name && validated.name !== existingBatch.name) {
      const duplicateBatch = await getBatchByName(validated.name)
      if (duplicateBatch && duplicateBatch.id !== id) {
        return {
          success: false,
          error: `A batch with the name "${validated.name}" already exists`,
        }
      }
    }

    // Execute database operation
    const batch = await updateBatch(id, {
      name: validated.name,
      startDate: validated.startDate,
      endDate: validated.endDate,
    })

    // Revalidate cache
    revalidatePath('/batches')
    revalidatePath(`/batches/${id}`)

    // Return success
    return {
      success: true,
      data: batch,
    }
  } catch (error) {
    // Handle errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.flatten().fieldErrors,
      }
    }

    console.error('[updateBatchAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update batch. Please try again.',
    }
  }
}

/**
 * Delete a batch with safety checks
 *
 * @param id - Batch ID to delete
 * @returns ActionResult indicating success or error
 */
export async function deleteBatchAction(
  id: string
): Promise<ActionResult<void>> {
  try {
    // Validate ID
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'Invalid batch ID',
      }
    }

    // Check if batch exists
    const existingBatch = await getBatchById(id)
    if (!existingBatch) {
      return {
        success: false,
        error: 'Batch not found',
      }
    }

    // Safety check: Check if batch has students
    const studentCount = await getBatchStudentCount(id)
    if (studentCount > 0) {
      return {
        success: false,
        error: `Cannot delete batch "${existingBatch.name}" because it has ${studentCount} student${studentCount > 1 ? 's' : ''} assigned. Please reassign or remove all students first.`,
      }
    }

    // Execute database operation
    await deleteBatch(id)

    // Revalidate cache
    revalidatePath('/batches')

    // Return success
    return {
      success: true,
    }
  } catch (error) {
    console.error('[deleteBatchAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete batch. Please try again.',
    }
  }
}
