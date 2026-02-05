/**
 * Centralized type definitions for Mahad Cohorts Admin module
 * Single source of truth for all types used across components
 */

import type { BatchWithCount } from '@/lib/db/queries/batch'
import type { MahadStudent } from '@/lib/db/queries/student'
import { StudentStatus } from '@/lib/types/student'

export type { MahadStudent } from '@/lib/db/queries/student'
export type { StudentFormData, UpdateStudentPayload } from './student-form'
export { FORM_DEFAULTS, isNoneValue } from './student-form'

export type MahadBatch = BatchWithCount

/**
 * Tab values for main navigation
 */
export type TabValue = 'students' | 'batches' | 'duplicates'

/**
 * Student filter types
 */
export interface StudentFilters {
  search: string
  batchId: string | null
  status: StudentStatus | null
}

/**
 * Stats for dashboard cards
 */
export interface DashboardStats {
  total: number
  active: number
  registered: number
  onLeave: number
  unpaid: number
}

/**
 * Dialog types for single-dialog pattern
 */
export type DialogType =
  | 'createBatch'
  | 'editBatch'
  | 'assignStudents'
  | 'deleteStudent'
  | 'paymentLink'
  | 'studentDetail'
  | 'resolveDuplicates'
  | null

// Re-export ActionResult from canonical location
export type { ActionResult } from '@/lib/utils/action-helpers'

/**
 * Duplicate group for duplicate detection
 * Contains both the record to keep and records to delete
 */
export interface DuplicateGroup {
  key: string
  matchValue: string
  matchType: 'email' | 'phone'
  students: MahadStudent[]
  keepRecord: MahadStudent
  duplicateRecords: MahadStudent[]
}
