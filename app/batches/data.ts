/**
 * Data Fetching Layer for Batches
 *
 * Server-side data fetching functions for Next.js App Router Server Components.
 * These functions wrap the query layer with error handling and validation.
 *
 * Usage:
 * - Import these functions in Server Components for data fetching
 * - Use Server Actions for mutations
 * - All functions handle errors and return type-safe results
 */

import { cache } from 'react'
import { unstable_noStore as noStore } from 'next/cache'

import {
  getBatches as getBatchesQuery,
  getBatchById as getBatchByIdQuery,
  getBatchByName as getBatchByNameQuery,
  getBatchStudents as getBatchStudentsQuery,
  getBatchStudentCount as getBatchStudentCountQuery,
  getBatchSummary as getBatchSummaryQuery,
  getBatchesWithFilters as getBatchesWithFiltersQuery,
} from '@/lib/db/queries/batch'

import {
  getStudents as getStudentsQuery,
  getStudentsWithBatch as getStudentsWithBatchQuery,
  getStudentById as getStudentByIdQuery,
  getStudentsByBatch as getStudentsByBatchQuery,
  getUnassignedStudents as getUnassignedStudentsQuery,
  searchStudents as searchStudentsQuery,
  findDuplicateStudents as findDuplicateStudentsQuery,
  getStudentCompleteness as getStudentCompletenessQuery,
  exportStudents as exportStudentsQuery,
} from '@/lib/db/queries/student'

// ============================================================================
// BATCH DATA FETCHING
// ============================================================================

/**
 * Get all batches with student count
 * Cached per request - safe to call multiple times
 */
export const getBatches = cache(async () => {
  try {
    const batches = await getBatchesQuery()
    return batches
  } catch (error) {
    console.error('Error fetching batches:', error)
    throw new Error('Failed to fetch batches')
  }
})

/**
 * Get a single batch by ID
 * Cached per request
 */
export const getBatchById = cache(async (id: string) => {
  try {
    const batch = await getBatchByIdQuery(id)
    return batch
  } catch (error) {
    console.error(`Error fetching batch ${id}:`, error)
    throw new Error('Failed to fetch batch')
  }
})

/**
 * Check if a batch name already exists
 * Not cached - used for validation
 */
export async function checkBatchNameExists(name: string): Promise<boolean> {
  noStore() // Don't cache this as it's used for validation
  try {
    const batch = await getBatchByNameQuery(name)
    return batch !== null
  } catch (error) {
    console.error('Error checking batch name:', error)
    return false
  }
}

/**
 * Get all students in a batch
 * Cached per request
 */
export const getBatchStudents = cache(async (batchId: string) => {
  try {
    const students = await getBatchStudentsQuery(batchId)
    return students
  } catch (error) {
    console.error(`Error fetching students for batch ${batchId}:`, error)
    throw new Error('Failed to fetch batch students')
  }
})

/**
 * Get student count for a batch
 * Cached per request
 */
export const getBatchStudentCount = cache(async (batchId: string) => {
  try {
    const count = await getBatchStudentCountQuery(batchId)
    return count
  } catch (error) {
    console.error(`Error fetching student count for batch ${batchId}:`, error)
    return 0
  }
})

/**
 * Get batch summary statistics
 * Cached per request
 */
export const getBatchSummary = cache(async () => {
  try {
    const summary = await getBatchSummaryQuery()
    return summary
  } catch (error) {
    console.error('Error fetching batch summary:', error)
    throw new Error('Failed to fetch batch summary')
  }
})

/**
 * Get batches with filters applied
 * Not cached - dynamic filtering
 */
export async function getBatchesWithFilters(filters: {
  search?: string
  hasStudents?: boolean
  dateRange?: {
    from: Date
    to: Date
  }
}) {
  noStore() // Dynamic filtering shouldn't be cached
  try {
    const batches = await getBatchesWithFiltersQuery(filters)
    return batches
  } catch (error) {
    console.error('Error fetching filtered batches:', error)
    throw new Error('Failed to fetch batches')
  }
}

// ============================================================================
// STUDENT DATA FETCHING
// ============================================================================

/**
 * Get all students
 * Cached per request
 */
export const getStudents = cache(async () => {
  try {
    const students = await getStudentsQuery()
    return students
  } catch (error) {
    console.error('Error fetching students:', error)
    throw new Error('Failed to fetch students')
  }
})

/**
 * Get all students with batch and sibling information
 * Cached per request
 */
export const getStudentsWithBatch = cache(async () => {
  try {
    const students = await getStudentsWithBatchQuery()
    return students
  } catch (error) {
    console.error('Error fetching students with batch info:', error)
    throw new Error('Failed to fetch students')
  }
})

/**
 * Get a single student by ID
 * Cached per request
 */
export const getStudentById = cache(async (id: string) => {
  try {
    const student = await getStudentByIdQuery(id)
    return student
  } catch (error) {
    console.error(`Error fetching student ${id}:`, error)
    throw new Error('Failed to fetch student')
  }
})

/**
 * Get students by batch ID
 * Cached per request
 */
export const getStudentsByBatch = cache(async (batchId: string) => {
  try {
    const students = await getStudentsByBatchQuery(batchId)
    return students
  } catch (error) {
    console.error(`Error fetching students for batch ${batchId}:`, error)
    throw new Error('Failed to fetch students')
  }
})

/**
 * Get unassigned students (no batch)
 * Cached per request
 */
export const getUnassignedStudents = cache(async () => {
  try {
    const students = await getUnassignedStudentsQuery()
    return students
  } catch (error) {
    console.error('Error fetching unassigned students:', error)
    throw new Error('Failed to fetch unassigned students')
  }
})

/**
 * Search students with filters and pagination
 * Not cached - dynamic search
 */
export async function searchStudents(
  query?: string,
  filters?: Parameters<typeof searchStudentsQuery>[1],
  pagination?: {
    page: number
    pageSize: number
  }
) {
  noStore() // Dynamic search shouldn't be cached
  try {
    const result = await searchStudentsQuery(query, filters, pagination)
    return result
  } catch (error) {
    console.error('Error searching students:', error)
    throw new Error('Failed to search students')
  }
}

/**
 * Find duplicate students
 * Not cached - potentially expensive operation
 */
export async function findDuplicateStudents() {
  noStore()
  try {
    const duplicates = await findDuplicateStudentsQuery()
    return duplicates
  } catch (error) {
    console.error('Error finding duplicate students:', error)
    throw new Error('Failed to find duplicate students')
  }
}

/**
 * Get student completeness information
 * Cached per request
 */
export const getStudentCompleteness = cache(async (id: string) => {
  try {
    const completeness = await getStudentCompletenessQuery(id)
    return completeness
  } catch (error) {
    console.error(`Error fetching completeness for student ${id}:`, error)
    throw new Error('Failed to fetch student completeness')
  }
})

/**
 * Export students data
 * Not cached - used for downloads
 */
export async function exportStudentsData(
  filters?: Parameters<typeof exportStudentsQuery>[0]
) {
  noStore()
  try {
    const data = await exportStudentsQuery(filters)
    return data
  } catch (error) {
    console.error('Error exporting students:', error)
    throw new Error('Failed to export students')
  }
}

// ============================================================================
// COMBINED DATA FETCHING
// ============================================================================

/**
 * Get batches and students together (for dashboard)
 * Uses cache() so both queries are cached per request
 */
export const getBatchesAndStudents = cache(async () => {
  try {
    const [batches, students] = await Promise.all([
      getBatchesQuery(),
      getStudentsWithBatchQuery(),
    ])
    return { batches, students }
  } catch (error) {
    console.error('Error fetching batches and students:', error)
    throw new Error('Failed to fetch data')
  }
})

/**
 * Get batch with its students
 * Combines batch and student data
 */
export const getBatchWithStudents = cache(async (batchId: string) => {
  try {
    const [batch, students] = await Promise.all([
      getBatchByIdQuery(batchId),
      getBatchStudentsQuery(batchId),
    ])

    if (!batch) {
      return null
    }

    return {
      ...batch,
      students,
    }
  } catch (error) {
    console.error(`Error fetching batch ${batchId} with students:`, error)
    throw new Error('Failed to fetch batch data')
  }
})
