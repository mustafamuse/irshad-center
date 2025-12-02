import type {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'

/**
 * Form data for student details sheet
 * Uses string for optional fields to support 'none' placeholder
 */
export interface StudentFormData {
  name: string
  email: string
  phone: string
  dateOfBirth: Date | null
  gradeLevel: string // 'none' | GradeLevel
  schoolName: string
  // Mahad billing fields
  graduationStatus: string // 'none' | GraduationStatus
  paymentFrequency: string // 'none' | PaymentFrequency
  billingType: string // 'none' | StudentBillingType
  paymentNotes: string
  batchId: string // 'none' | string (batch ID)
}

/**
 * Payload for updating student via server action
 * All fields optional except those that should never be null
 */
export interface UpdateStudentPayload {
  name?: string
  email?: string | null
  phone?: string | null
  dateOfBirth?: Date | null
  gradeLevel?: GradeLevel | null
  schoolName?: string | null
  // Mahad billing fields
  graduationStatus?: GraduationStatus | null
  paymentFrequency?: PaymentFrequency | null
  billingType?: StudentBillingType | null
  paymentNotes?: string | null
  batchId?: string | null
}

/**
 * Constants for form field defaults
 */
export const FORM_DEFAULTS = {
  NONE: 'none' as const,
  EMPTY: '' as const,
  DEFAULT_RATE: 150 as const,
} as const

/**
 * Type for empty/none placeholder values
 */
export type EmptyValue = typeof FORM_DEFAULTS.NONE | typeof FORM_DEFAULTS.EMPTY

/**
 * Type guard to check if a value is the 'none' or empty placeholder
 * @param value - Value to check
 * @returns true if value is 'none' or empty string
 */
export function isNoneValue(value: string): value is EmptyValue {
  return value === FORM_DEFAULTS.NONE || value === FORM_DEFAULTS.EMPTY
}
