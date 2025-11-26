'use server'

/**
 * Update Student Action
 *
 * Wraps the existing updateMahadStudent service for action-based updates.
 */

import { EducationLevel, GradeLevel } from '@prisma/client'

import {
  updateMahadStudent,
  StudentUpdateInput,
} from '@/lib/services/mahad/student-service'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UpdateStudentData {
  name?: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  educationLevel?: EducationLevel | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  monthlyRate?: number
  customRate?: boolean
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
 * - ContactPoint updates (email, phone) with P2002 handling
 * - ProgramProfile field updates
 */
export async function updateStudent(
  studentId: string,
  data: UpdateStudentData
): Promise<UpdateStudentResult> {
  try {
    // Map to service input format
    const updateInput: StudentUpdateInput = {}

    if (data.name !== undefined) {
      updateInput.name = data.name
    }
    if (data.email !== undefined) {
      updateInput.email = data.email
    }
    if (data.phone !== undefined) {
      updateInput.phone = data.phone
    }
    if (data.dateOfBirth !== undefined) {
      updateInput.dateOfBirth = data.dateOfBirth
    }
    if (data.educationLevel !== undefined) {
      updateInput.educationLevel = data.educationLevel
    }
    if (data.gradeLevel !== undefined) {
      updateInput.gradeLevel = data.gradeLevel
    }
    if (data.schoolName !== undefined) {
      updateInput.schoolName = data.schoolName
    }
    if (data.monthlyRate !== undefined) {
      updateInput.monthlyRate = data.monthlyRate
    }
    if (data.customRate !== undefined) {
      updateInput.customRate = data.customRate
    }

    // Call the existing service
    await updateMahadStudent(studentId, updateInput)

    return { success: true }
  } catch (error) {
    console.error('Update student error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update student',
    }
  }
}
