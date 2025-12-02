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
 * Mirrors StudentWithBatchData from lib/db/queries/student.ts
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
  | 'assignStudents'
  | 'deleteStudent'
  | 'paymentLink'
  | 'studentDetail'
  | 'resolveDuplicates'
  | null

/**
 * Action result for server actions
 */
export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

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
