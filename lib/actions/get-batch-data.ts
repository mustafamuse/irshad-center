'use server'

/**
 * Batch Data Actions
 *
 * IMPORTANT: These actions need migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

import { EducationLevel, GradeLevel } from '@prisma/client'

export interface BatchStudentData {
  id: string
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  educationLevel: EducationLevel | null
  gradeLevel: GradeLevel | null
  schoolName: string | null
  status: string
  createdAt: string
  updatedAt: string
  batch: {
    id: string
    name: string
    startDate: string | null
    endDate: string | null
  } | null
  siblingGroup: {
    id: string
    students: {
      id: string
      name: string
      status: string
    }[]
  } | null
}

export async function getBatchData(): Promise<BatchStudentData[]> {
  console.error(
    '[GET_BATCH_DATA] getBatchData disabled during schema migration'
  )
  return []
}

export async function getDuplicateStudents() {
  console.error(
    '[GET_BATCH_DATA] getDuplicateStudents disabled during schema migration'
  )
  return []
}

export async function deleteDuplicateRecords(_recordIds: string[]) {
  console.error(
    '[GET_BATCH_DATA] deleteDuplicateRecords disabled during schema migration'
  )
  return { success: false, error: 'Needs migration.' }
}
