/**
 * Centralized type definitions for Mahad Cohorts Admin module
 * Single source of truth for all types used across components
 */

import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'

import { StudentStatus } from '@/lib/types/student'

export type { StudentFormData, UpdateStudentPayload } from './student-form'
export { FORM_DEFAULTS, isNoneValue } from './student-form'

/**
 * MahadStudent - DTO for Mahad student data displayed in admin UI
 */
export interface MahadStudent {
  id: string
  name: string
  email: string | null
  phone: string | null
  dateOfBirth: Date | null
  gradeLevel: GradeLevel | null
  schoolName: string | null
  graduationStatus: GraduationStatus | null
  paymentFrequency: PaymentFrequency | null
  billingType: StudentBillingType | null
  paymentNotes: string | null
  status: StudentStatus
  batchId: string | null
  createdAt: Date
  updatedAt: Date
  batch: {
    id: string
    name: string
    startDate: Date | null
    endDate: Date | null
  } | null
  subscription: {
    id: string
    status: string
    stripeSubscriptionId: string | null
    amount: number
  } | null
  siblingCount?: number
}

/**
 * Batch with student count
 */
export interface MahadBatch {
  id: string
  name: string
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
  updatedAt: Date
  studentCount: number
}

/**
 * Tab values for main navigation
 */
export type TabValue = 'students' | 'batches' | 'duplicates'

/**
 * PaymentHealth - Unified status combining enrollment + subscription + billing type
 *
 * Values:
 * - needs_action: ENROLLED + payment problems (canceled/unpaid/no sub when not EXEMPT)
 * - at_risk: ENROLLED + past_due subscription
 * - healthy: ENROLLED + active/trialing subscription
 * - exempt: ENROLLED + EXEMPT billing type ($0 rate - TA, financial hardship)
 * - pending: REGISTERED (not yet enrolled)
 * - inactive: WITHDRAWN/ON_LEAVE/COMPLETED (no longer active)
 */
export type PaymentHealth =
  | 'needs_action'
  | 'at_risk'
  | 'healthy'
  | 'exempt'
  | 'pending'
  | 'inactive'

/**
 * Student filter types
 */
export interface StudentFilters {
  search: string
  batchId: string | null
  paymentHealth: PaymentHealth | null
}

/**
 * Stats for dashboard cards
 */
export interface DashboardStats {
  total: number
  enrolled: number
  healthy: number
  atRisk: number
  needsAction: number
  exempt: number
  pending: number
  inactive: number
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

/**
 * Type-safe dialog state using discriminated union
 * Ensures correct data type is passed for each dialog type
 */
export type DialogState =
  | { type: null; data: null }
  | { type: 'createBatch'; data: null }
  | { type: 'editBatch'; data: MahadBatch }
  | { type: 'assignStudents'; data: null }
  | { type: 'deleteStudent'; data: MahadStudent }
  | { type: 'paymentLink'; data: MahadStudent }
  | { type: 'studentDetail'; data: MahadStudent }
  | { type: 'resolveDuplicates'; data: DuplicateGroup }

/**
 * Extract dialog data type for a specific dialog type
 */
export type DialogDataFor<T extends DialogType> = Extract<
  DialogState,
  { type: T }
>['data']

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
