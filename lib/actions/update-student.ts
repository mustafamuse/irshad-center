'use server'

/**
 * Update Student Action
 *
 * Wraps the existing updateMahadStudent service for action-based updates.
 */

import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'

import { assertAdmin } from '@/lib/auth'
import { ActionError } from '@/lib/errors/action-error'
import { createActionLogger, logError } from '@/lib/logger'
import {
  updateMahadStudent,
  StudentUpdateInput,
} from '@/lib/services/mahad/student-service'

const logger = createActionLogger('update-student')

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UpdateStudentData {
  name?: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  // Mahad billing fields
  graduationStatus?: GraduationStatus | null
  paymentFrequency?: PaymentFrequency | null
  billingType?: StudentBillingType | null
  paymentNotes?: string | null
}

interface UpdateStudentResult {
  success: boolean
  error?: string
}

// ============================================================================
// MAIN ACTION
// ============================================================================

/**
 * Update a Mahad student's information
 *
 * Uses the existing updateMahadStudent service which handles:
 * - Person name and dateOfBirth updates
 * - Person email/phone updates with P2002 handling
 * - ProgramProfile field updates
 */
export async function updateStudent(
  studentId: string,
  data: UpdateStudentData
): Promise<UpdateStudentResult> {
  try {
    await assertAdmin('updateStudent')
    // Filter out undefined values and pass directly to service
    const updateInput: StudentUpdateInput = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    ) as StudentUpdateInput

    await updateMahadStudent(studentId, updateInput)

    return { success: true }
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to update student', { studentId })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update student',
    }
  }
}
