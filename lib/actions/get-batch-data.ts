'use server'

/**
 * Batch Data Actions
 *
 * IMPORTANT: These actions need migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

import { EducationLevel, GradeLevel } from '@prisma/client'

import {
  createStubbedAction,
  createStubbedQuery,
} from '@/lib/utils/stub-helpers'

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

export const getBatchData = createStubbedQuery<[], BatchStudentData[]>(
  { feature: 'getBatchData', reason: 'schema_migration' },
  []
)

export const getDuplicateStudents = createStubbedQuery<[], unknown[]>(
  { feature: 'getDuplicateStudents', reason: 'schema_migration' },
  []
)

export const deleteDuplicateRecords = createStubbedAction<[string[]]>({
  feature: 'deleteDuplicateRecords',
  reason: 'schema_migration',
})
