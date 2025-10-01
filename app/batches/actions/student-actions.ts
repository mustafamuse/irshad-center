'use server'

/**
 * Student Server Actions
 *
 * Server-side mutations for student operations with Zod validation.
 * All actions follow Next.js App Router best practices.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentById,
  getStudentByEmail,
  getStudentDeleteWarnings,
  bulkUpdateStudentStatus,
} from '@/lib/db/queries/student'
import {
  CreateStudentSchema,
  UpdateStudentSchema,
  type CreateStudentInput,
  type UpdateStudentInput,
} from '@/lib/validations/batch'

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
 * Create a new student
 *
 * @param formData - FormData containing student information
 * @returns ActionResult with created student or error
 */
export async function createStudentAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    // Parse form data
    const rawData: Partial<CreateStudentInput> = {
      name: formData.get('name') as string,
    }

    // Parse optional fields
    const email = formData.get('email')
    if (email && email !== '') rawData.email = email as string

    const phone = formData.get('phone')
    if (phone && phone !== '') rawData.phone = phone as string

    const dateOfBirth = formData.get('dateOfBirth')
    if (dateOfBirth && dateOfBirth !== '') {
      rawData.dateOfBirth = new Date(dateOfBirth as string)
    }

    const educationLevel = formData.get('educationLevel')
    if (educationLevel && educationLevel !== '') {
      rawData.educationLevel = educationLevel as any
    }

    const gradeLevel = formData.get('gradeLevel')
    if (gradeLevel && gradeLevel !== '') {
      rawData.gradeLevel = gradeLevel as any
    }

    const schoolName = formData.get('schoolName')
    if (schoolName && schoolName !== '') {
      rawData.schoolName = schoolName as string
    }

    const monthlyRate = formData.get('monthlyRate')
    if (monthlyRate && monthlyRate !== '') {
      rawData.monthlyRate = parseFloat(monthlyRate as string)
    }

    const customRate = formData.get('customRate')
    if (customRate !== null) {
      rawData.customRate = customRate === 'true'
    }

    const batchId = formData.get('batchId')
    if (batchId && batchId !== '') {
      rawData.batchId = batchId as string
    }

    // Validate with Zod
    const validated = CreateStudentSchema.parse(rawData)

    // Check for duplicate email
    if (validated.email) {
      const existingStudent = await getStudentByEmail(validated.email)
      if (existingStudent) {
        return {
          success: false,
          error: `A student with the email "${validated.email}" already exists`,
        }
      }
    }

    // Execute database operation
    const student = await createStudent({
      name: validated.name,
      email: validated.email || null,
      phone: validated.phone || null,
      dateOfBirth: validated.dateOfBirth || null,
      educationLevel: validated.educationLevel || null,
      gradeLevel: validated.gradeLevel || null,
      schoolName: validated.schoolName || null,
      monthlyRate: validated.monthlyRate,
      customRate: validated.customRate,
      batchId: validated.batchId || null,
    })

    // Revalidate cache
    revalidatePath('/batches')
    if (validated.batchId) {
      revalidatePath(`/batches/${validated.batchId}`)
    }

    // Return success
    return {
      success: true,
      data: student,
    }
  } catch (error) {
    // Handle errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.flatten().fieldErrors,
      }
    }

    console.error('[createStudentAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create student. Please try again.',
    }
  }
}

/**
 * Update an existing student
 *
 * @param id - Student ID to update
 * @param formData - FormData containing updated student information
 * @returns ActionResult with updated student or error
 */
export async function updateStudentAction(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    // Validate ID
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'Invalid student ID',
      }
    }

    // Check if student exists
    const existingStudent = await getStudentById(id)
    if (!existingStudent) {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Parse form data - only include fields that are present
    const rawData: Partial<UpdateStudentInput> = {}

    const name = formData.get('name')
    if (name !== null) rawData.name = name as string

    const email = formData.get('email')
    if (email !== null) rawData.email = email === '' ? '' : (email as string)

    const phone = formData.get('phone')
    if (phone !== null) rawData.phone = phone === '' ? '' : (phone as string)

    const dateOfBirth = formData.get('dateOfBirth')
    if (dateOfBirth !== null && dateOfBirth !== '') {
      rawData.dateOfBirth = new Date(dateOfBirth as string)
    }

    const educationLevel = formData.get('educationLevel')
    if (educationLevel !== null && educationLevel !== '') {
      rawData.educationLevel = educationLevel as any
    }

    const gradeLevel = formData.get('gradeLevel')
    if (gradeLevel !== null && gradeLevel !== '') {
      rawData.gradeLevel = gradeLevel as any
    }

    const schoolName = formData.get('schoolName')
    if (schoolName !== null) {
      rawData.schoolName = schoolName === '' ? '' : (schoolName as string)
    }

    const monthlyRate = formData.get('monthlyRate')
    if (monthlyRate !== null && monthlyRate !== '') {
      rawData.monthlyRate = parseFloat(monthlyRate as string)
    }

    const customRate = formData.get('customRate')
    if (customRate !== null) {
      rawData.customRate = customRate === 'true'
    }

    const batchId = formData.get('batchId')
    const shouldUpdateBatchId = batchId !== null
    let validatedBatchId: string | null | undefined = undefined
    if (shouldUpdateBatchId) {
      if (batchId === '') {
        validatedBatchId = null
      } else {
        rawData.batchId = batchId as string
      }
    }

    // Validate with Zod
    const validated = UpdateStudentSchema.parse(rawData)

    // Check for duplicate email (if changing email)
    if (
      validated.email &&
      validated.email !== existingStudent.email &&
      validated.email !== ''
    ) {
      const duplicateStudent = await getStudentByEmail(validated.email)
      if (duplicateStudent && duplicateStudent.id !== id) {
        return {
          success: false,
          error: `A student with the email "${validated.email}" already exists`,
        }
      }
    }

    // Track old batch for revalidation
    const oldBatchId = existingStudent.batchId

    // Execute database operation
    const student = await updateStudent(id, {
      name: validated.name,
      email:
        validated.email === undefined
          ? undefined
          : validated.email === ''
            ? null
            : validated.email,
      phone:
        validated.phone === undefined
          ? undefined
          : validated.phone === ''
            ? null
            : validated.phone,
      dateOfBirth: validated.dateOfBirth,
      educationLevel: validated.educationLevel,
      gradeLevel: validated.gradeLevel,
      schoolName:
        validated.schoolName === undefined
          ? undefined
          : validated.schoolName === ''
            ? null
            : validated.schoolName,
      monthlyRate: validated.monthlyRate,
      customRate: validated.customRate,
      batchId: shouldUpdateBatchId
        ? validatedBatchId !== undefined
          ? validatedBatchId
          : validated.batchId
        : undefined,
    })

    // Revalidate cache
    revalidatePath('/batches')
    if (oldBatchId) {
      revalidatePath(`/batches/${oldBatchId}`)
    }
    const newBatchId =
      validatedBatchId !== undefined ? validatedBatchId : validated.batchId
    if (newBatchId) {
      revalidatePath(`/batches/${newBatchId}`)
    }

    // Return success
    return {
      success: true,
      data: student,
    }
  } catch (error) {
    // Handle errors
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.flatten().fieldErrors,
      }
    }

    console.error('[updateStudentAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update student. Please try again.',
    }
  }
}

/**
 * Delete a student with safety checks
 *
 * @param id - Student ID to delete
 * @returns ActionResult indicating success or error
 */
export async function deleteStudentAction(
  id: string
): Promise<ActionResult<void>> {
  try {
    // Validate ID
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'Invalid student ID',
      }
    }

    // Check if student exists
    const existingStudent = await getStudentById(id)
    if (!existingStudent) {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Safety check: Get warnings about dependencies
    const warnings = await getStudentDeleteWarnings(id)

    // Build warning message
    const warningMessages: string[] = []
    if (warnings.hasSiblings) {
      warningMessages.push('This student is part of a sibling group')
    }
    if (warnings.hasAttendanceRecords) {
      warningMessages.push('This student has attendance records')
    }

    if (warningMessages.length > 0) {
      return {
        success: false,
        error: `Warning: ${warningMessages.join(', ')}. Deleting this student will remove all associated data. This action cannot be undone.`,
      }
    }

    // Track batch for revalidation
    const batchId = existingStudent.batchId

    // Execute database operation
    await deleteStudent(id)

    // Revalidate cache
    revalidatePath('/batches')
    if (batchId) {
      revalidatePath(`/batches/${batchId}`)
    }

    // Return success
    return {
      success: true,
    }
  } catch (error) {
    console.error('[deleteStudentAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete student. Please try again.',
    }
  }
}

/**
 * Bulk update student status
 *
 * @param studentIds - Array of student IDs to update
 * @param status - New status to set
 * @returns ActionResult with count of updated students or error
 */
export async function bulkUpdateStudentStatusAction(
  studentIds: string[],
  status: string
): Promise<ActionResult<{ count: number }>> {
  try {
    // Validate input
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return {
        success: false,
        error: 'No students selected',
      }
    }

    if (!status || typeof status !== 'string') {
      return {
        success: false,
        error: 'Invalid status',
      }
    }

    // Validate status enum
    const validStatuses = [
      'ACTIVE',
      'INACTIVE',
      'GRADUATED',
      'SUSPENDED',
      'TRANSFERRED',
      'registered',
    ]
    if (!validStatuses.includes(status)) {
      return {
        success: false,
        error: 'Invalid status value',
      }
    }

    // Execute database operation
    const count = await bulkUpdateStudentStatus(studentIds, status)

    // Revalidate cache
    revalidatePath('/batches')

    // Return success
    return {
      success: true,
      data: { count },
    }
  } catch (error) {
    console.error('[bulkUpdateStudentStatusAction] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update student status. Please try again.',
    }
  }
}
