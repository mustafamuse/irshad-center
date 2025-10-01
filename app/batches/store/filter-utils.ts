/**
 * Client-Side Filtering Utilities
 *
 * Helper functions to filter students based on UI store filters.
 * These run on the client after data is fetched from Server Components.
 */

import { StudentFilters } from './ui-store'
import { BatchStudentData, StudentStatus } from '@/lib/types/batch'

/**
 * Filter students based on current filter state
 */
export function filterStudents(
  students: BatchStudentData[],
  filters: StudentFilters
): BatchStudentData[] {
  return students.filter((student) => {
    // Search filter
    if (filters.search?.query) {
      const searchQuery = filters.search.query.toLowerCase()
      const matchesSearch =
        filters.search.fields?.some((field) => {
          const value = student[field]
          return value && value.toLowerCase().includes(searchQuery)
        }) ?? false
      if (!matchesSearch) return false
    }

    // Batch filter
    if ((filters.batch?.selected?.length ?? 0) > 0) {
      const studentBatchId = student.batch?.id
      const isInSelectedBatch =
        studentBatchId && filters.batch?.selected?.includes(studentBatchId)
      const isUnassignedAndIncluded =
        !studentBatchId && filters.batch?.includeUnassigned

      if (!isInSelectedBatch && !isUnassignedAndIncluded) return false
    }

    // Status filter
    if ((filters.status?.selected?.length ?? 0) > 0) {
      const studentStatus = student.status as StudentStatus
      if (!filters.status?.selected?.includes(studentStatus)) return false
    }

    // Education level filter
    if ((filters.educationLevel?.selected?.length ?? 0) > 0) {
      if (
        !student.educationLevel ||
        !filters.educationLevel?.selected?.includes(student.educationLevel)
      ) {
        return false
      }
    }

    // Grade level filter
    if ((filters.gradeLevel?.selected?.length ?? 0) > 0) {
      if (
        !student.gradeLevel ||
        !filters.gradeLevel?.selected?.includes(student.gradeLevel)
      ) {
        return false
      }
    }

    // Date range filter
    if (filters.dateRange?.from || filters.dateRange?.to) {
      const field = filters.dateRange?.field ?? 'createdAt'
      const fieldValue = student[field]
      const studentDate = new Date(
        fieldValue instanceof Date
          ? fieldValue
          : (fieldValue as string | number | null) || new Date()
      )

      if (filters.dateRange?.from && studentDate < filters.dateRange.from)
        return false
      if (filters.dateRange?.to && studentDate > filters.dateRange.to)
        return false
    }

    return true
  })
}

/**
 * Get count of students in a specific batch
 */
export function getBatchStudentCount(
  students: BatchStudentData[],
  batchId: string
): number {
  return students.filter((s) => s.batch?.id === batchId).length
}

/**
 * Get count of unassigned students
 */
export function getUnassignedStudentsCount(
  students: BatchStudentData[]
): number {
  return students.filter((s) => !s.batch).length
}

/**
 * Get students selected by ID
 */
export function getSelectedStudentsData(
  students: BatchStudentData[],
  selectedIds: Set<string>
): BatchStudentData[] {
  return students.filter((s) => selectedIds.has(s.id))
}

/**
 * Get filter summary for display
 */
export function getFilterSummary(filters: StudentFilters): string[] {
  const summary: string[] = []

  if (filters.search?.query) {
    summary.push(`Search: "${filters.search.query}"`)
  }

  if ((filters.batch?.selected?.length ?? 0) > 0) {
    summary.push(`Batches: ${filters.batch?.selected?.length} selected`)
  }

  if ((filters.status?.selected?.length ?? 0) > 0) {
    summary.push(`Status: ${filters.status?.selected?.join(', ')}`)
  }

  if ((filters.educationLevel?.selected?.length ?? 0) > 0) {
    summary.push(`Education: ${filters.educationLevel?.selected?.length} levels`)
  }

  if ((filters.gradeLevel?.selected?.length ?? 0) > 0) {
    summary.push(`Grades: ${filters.gradeLevel?.selected?.length} levels`)
  }

  if (filters.dateRange?.from || filters.dateRange?.to) {
    summary.push('Date range applied')
  }

  return summary
}

/**
 * Check if a specific filter type is active
 */
export function isFilterActive(
  filters: StudentFilters,
  filterType: keyof StudentFilters
): boolean {
  switch (filterType) {
    case 'search':
      return (filters.search?.query?.length ?? 0) > 0
    case 'batch':
      return (filters.batch?.selected?.length ?? 0) > 0
    case 'status':
      return (filters.status?.selected?.length ?? 0) > 0
    case 'educationLevel':
      return (filters.educationLevel?.selected?.length ?? 0) > 0
    case 'gradeLevel':
      return (filters.gradeLevel?.selected?.length ?? 0) > 0
    case 'dateRange':
      return (
        filters.dateRange?.from !== null || filters.dateRange?.to !== null
      )
    default:
      return false
  }
}

/**
 * Count active filters
 */
export function countActiveFilters(filters: StudentFilters): number {
  let count = 0

  if ((filters.search?.query?.length ?? 0) > 0) count++
  if ((filters.batch?.selected?.length ?? 0) > 0) count++
  if ((filters.status?.selected?.length ?? 0) > 0) count++
  if ((filters.educationLevel?.selected?.length ?? 0) > 0) count++
  if ((filters.gradeLevel?.selected?.length ?? 0) > 0) count++
  if (filters.dateRange?.from || filters.dateRange?.to) count++

  return count
}
