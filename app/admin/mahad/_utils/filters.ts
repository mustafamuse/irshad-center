/**
 * Filter utilities for Mahad students
 * Pure functions for filtering logic
 */

import { StudentStatus } from '@/lib/types/student'

import { MahadStudent, StudentFilters } from '../_types'

export function filterBySearch(
  students: MahadStudent[],
  query: string
): MahadStudent[] {
  if (!query.trim()) return students

  const lowerQuery = query.toLowerCase().trim()
  return students.filter((student) => {
    const searchableFields = [
      student.name,
      student.email,
      student.phone,
      student.batch?.name,
    ]
    return searchableFields.some((field) =>
      field?.toLowerCase().includes(lowerQuery)
    )
  })
}

export function filterByBatch(
  students: MahadStudent[],
  batchId: string | null
): MahadStudent[] {
  if (!batchId) return students
  if (batchId === 'unassigned') {
    return students.filter((s) => !s.batchId)
  }
  return students.filter((s) => s.batchId === batchId)
}

export function filterByStatus(
  students: MahadStudent[],
  status: StudentStatus | null
): MahadStudent[] {
  if (!status) return students
  return students.filter((s) => s.status === status)
}

export function applyAllFilters(
  students: MahadStudent[],
  filters: StudentFilters
): MahadStudent[] {
  let result = students

  if (filters.search) {
    result = filterBySearch(result, filters.search)
  }

  if (filters.batchId !== null) {
    result = filterByBatch(result, filters.batchId)
  }

  if (filters.status !== null) {
    result = filterByStatus(result, filters.status)
  }

  return result
}
