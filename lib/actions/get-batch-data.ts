'use server'

// ⚠️ CRITICAL MIGRATION NEEDED: This file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model

import { EducationLevel, GradeLevel } from '@prisma/client'

import { _prisma } from '@/lib/db'

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
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}

export async function getDuplicateStudents() {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}

export async function deleteDuplicateRecords(_recordIds: string[]) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed')
}
