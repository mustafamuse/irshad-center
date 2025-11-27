import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'

import type { BatchStudentData, StudentDetailData } from '@/lib/types/batch'
import { formatEnumValue } from '@/lib/utils/formatters'

import {
  FORM_DEFAULTS,
  isNoneValue,
  type StudentFormData,
  type UpdateStudentPayload,
} from '../_types/student-form'

/**
 * Get default form data from student record
 * Converts null/undefined to appropriate form defaults
 */
export function getDefaultFormData(
  student: BatchStudentData | StudentDetailData
): StudentFormData {
  return {
    name: student.name,
    email: student.email || FORM_DEFAULTS.EMPTY,
    phone: student.phone || FORM_DEFAULTS.EMPTY,
    dateOfBirth: student.dateOfBirth ?? null,
    gradeLevel: student.gradeLevel || FORM_DEFAULTS.NONE,
    schoolName: student.schoolName || FORM_DEFAULTS.EMPTY,
    // Mahad billing fields
    graduationStatus: student.graduationStatus || FORM_DEFAULTS.NONE,
    paymentFrequency: student.paymentFrequency || FORM_DEFAULTS.NONE,
    billingType: student.billingType || FORM_DEFAULTS.NONE,
    paymentNotes: student.paymentNotes || FORM_DEFAULTS.EMPTY,
    batchId: student.batchId || FORM_DEFAULTS.NONE,
  }
}

/**
 * Convert form data to API payload
 * Handles 'none' placeholder conversion to null
 */
export function convertFormDataToPayload(
  formData: StudentFormData
): UpdateStudentPayload {
  return {
    name: formData.name,
    email: formData.email || null,
    phone: formData.phone || null,
    dateOfBirth: formData.dateOfBirth || null,
    gradeLevel: isNoneValue(formData.gradeLevel)
      ? null
      : (formData.gradeLevel as GradeLevel),
    schoolName: formData.schoolName || null,
    // Mahad billing fields
    graduationStatus: isNoneValue(formData.graduationStatus)
      ? null
      : (formData.graduationStatus as GraduationStatus),
    paymentFrequency: isNoneValue(formData.paymentFrequency)
      ? null
      : (formData.paymentFrequency as PaymentFrequency),
    billingType: isNoneValue(formData.billingType)
      ? null
      : (formData.billingType as StudentBillingType),
    paymentNotes: formData.paymentNotes || null,
    batchId: isNoneValue(formData.batchId) ? null : formData.batchId,
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  if (!email) return true // Empty email is optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate phone number format
 */
function isValidPhone(phone: string): boolean {
  if (!phone) return true // Empty phone is optional
  const digits = phone.replace(/\D/g, '')
  // Allow 10 or 11 digit numbers
  return digits.length >= 10 && digits.length <= 11
}

/**
 * Check if form data is valid
 * Returns true if all required fields are present and valid
 */
export function isFormValid(formData: StudentFormData): boolean {
  // Name is required and must not be empty/whitespace
  if (!formData.name || formData.name.trim() === '') {
    return false
  }

  // Email must be valid if provided
  if (formData.email && !isValidEmail(formData.email)) {
    return false
  }

  // Phone must be valid if provided
  if (formData.phone && !isValidPhone(formData.phone)) {
    return false
  }

  return true
}

/**
 * Check if form data has changes compared to original student
 */
export function hasFormChanges(
  formData: StudentFormData,
  original: BatchStudentData | StudentDetailData
): boolean {
  const originalData = getDefaultFormData(original)

  return (
    formData.name !== originalData.name ||
    formData.email !== originalData.email ||
    formData.phone !== originalData.phone ||
    formData.dateOfBirth?.getTime() !== originalData.dateOfBirth?.getTime() ||
    formData.gradeLevel !== originalData.gradeLevel ||
    formData.schoolName !== originalData.schoolName ||
    formData.graduationStatus !== originalData.graduationStatus ||
    formData.paymentFrequency !== originalData.paymentFrequency ||
    formData.billingType !== originalData.billingType ||
    formData.paymentNotes !== originalData.paymentNotes ||
    formData.batchId !== originalData.batchId
  )
}

/**
 * Format grade level for display
 * Uses shared formatEnumValue utility to convert UPPER_SNAKE_CASE to Title Case
 */
export function formatGradeLevel(grade: string | null): string {
  return formatEnumValue(grade)
}

/**
 * Format graduation status for display
 */
export function formatGraduationStatus(status: string | null): string {
  return formatEnumValue(status)
}

/**
 * Format billing type for display
 */
export function formatBillingType(type: string | null): string {
  return formatEnumValue(type)
}
