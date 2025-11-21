// ⚠️ CRITICAL MIGRATION NEEDED: This file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model

/**
 * Student Query Functions
 *
 * Direct Prisma queries for student operations following Next.js App Router best practices.
 * These functions replace the Repository/Service pattern with simple, composable query functions.
 */

import { EducationLevel, GradeLevel } from '@prisma/client'

// TODO: All functions in this file have been stubbed to return empty/null values
// Full migration to ProgramProfile/Enrollment model is required

/**
 * Get all students with basic information
 */
export async function getStudents() {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}

/**
 * Get all students with batch and sibling information (excluding withdrawn)
 */
export async function getStudentsWithBatch() {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}

/**
 * Get students with batch info, filtering, and pagination
 * Server-side version to replace client-side filtering
 */
export async function getStudentsWithBatchFiltered(params: {
  page?: number
  limit?: number
  search?: string
  batchIds?: string[]
  includeUnassigned?: boolean
  statuses?: string[]
  subscriptionStatuses?: string[]
  educationLevels?: EducationLevel[]
  gradeLevels?: GradeLevel[]
}) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return {
    students: [],
    totalCount: 0,
    page: params.page || 1,
    limit: params.limit || 50,
    totalPages: 0,
  } // Temporary: return empty result until migration complete
}

/**
 * Get a single student by ID
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getStudentById(_id: string): Promise<any> {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return null // Temporary: return null until migration complete
}

/**
 * Get a student by email (case-insensitive)
 */
export async function getStudentByEmail(_email: string) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return null // Temporary: return null until migration complete
}

/**
 * Get students by batch ID
 */
export async function getStudentsByBatch(_batchId: string) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}

/**
 * Get unassigned students (no batch)
 */
export async function getUnassignedStudents() {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}

/**
 * Create a new student
 */
export async function createStudent(_data: {
  name: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  educationLevel?: EducationLevel | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  monthlyRate?: number
  customRate?: boolean
  batchId?: string | null
}) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed')
}

/**
 * Update a student
 */
export async function updateStudent(
  _id: string,
  _data: {
    name?: string
    email?: string | null
    phone?: string | null
    dateOfBirth?: Date | null
    educationLevel?: EducationLevel | null
    gradeLevel?: GradeLevel | null
    schoolName?: string | null
    status?: string
    monthlyRate?: number
    customRate?: boolean
    batchId?: string | null
  }
) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed')
}

/**
 * Delete a student
 */
export async function deleteStudent(_id: string) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed')
}

/**
 * Search students with filters and pagination
 */
export async function searchStudents(
  _query?: string,
  _filters?: {
    search?: {
      query?: string
      fields?: ('name' | 'email' | 'phone')[]
    }
    batch?: {
      selected?: string[]
      includeUnassigned?: boolean
    }
    status?: {
      selected?: string[]
    }
    educationLevel?: {
      selected?: EducationLevel[]
    }
    gradeLevel?: {
      selected?: GradeLevel[]
    }
    dateRange?: {
      from?: Date
      to?: Date
      field?: 'createdAt' | 'updatedAt' | 'dateOfBirth'
    }
  },
  _pagination?: {
    page: number
    pageSize: number
  }
) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return {
    students: [],
    totalResults: 0,
  } // Temporary: return empty result until migration complete
}

/**
 * Find duplicate students by phone number
 * Uses exact phone matching only - the most reliable indicator of duplicates
 */
export async function findDuplicateStudents() {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}

/**
 * Resolve duplicate students by keeping one and deleting others
 */
export async function resolveDuplicateStudents(
  keepId: string,
  deleteIds: string[],
  _mergeData: boolean = false
) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed')
}

/**
 * Bulk update student status
 */
export async function bulkUpdateStudentStatus(
  _studentIds: string[],
  _status: string
) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return 0 // Temporary: return 0 updates until migration complete
}

/**
 * Get student completeness information
 */
export async function getStudentCompleteness(_id: string) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  throw new Error('Migration needed: Student model has been removed')
}

/**
 * Get delete warnings for a student (check for dependencies)
 */
export async function getStudentDeleteWarnings(_id: string) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return {
    hasSiblings: false,
    hasAttendanceRecords: false,
  } // Temporary: return safe defaults until migration complete
}

/**
 * Export students data
 */
export async function exportStudents(_filters?: {
  search?: {
    query?: string
    fields?: ('name' | 'email' | 'phone')[]
  }
  batch?: {
    selected?: string[]
    includeUnassigned?: boolean
  }
  status?: {
    selected?: string[]
  }
  educationLevel?: {
    selected?: EducationLevel[]
  }
  gradeLevel?: {
    selected?: GradeLevel[]
  }
  dateRange?: {
    from?: Date
    to?: Date
    field?: 'createdAt' | 'updatedAt' | 'dateOfBirth'
  }
}) {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return [] // Temporary: return empty array until migration complete
}

/**
 * Build Prisma where clause for student queries
 */
function _buildStudentWhereClause(
  _query?: string,
  _filters?: {
    search?: {
      query?: string
      fields?: ('name' | 'email' | 'phone')[]
    }
    batch?: {
      selected?: string[]
      includeUnassigned?: boolean
    }
    status?: {
      selected?: string[]
    }
    educationLevel?: {
      selected?: EducationLevel[]
    }
    gradeLevel?: {
      selected?: GradeLevel[]
    }
    dateRange?: {
      from?: Date
      to?: Date
      field?: 'createdAt' | 'updatedAt' | 'dateOfBirth'
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // TODO: Migrate to ProgramProfile/Enrollment model - Student model removed
  return {} // Temporary: return empty where clause until migration complete
}
