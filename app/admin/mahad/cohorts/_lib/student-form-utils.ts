// Browser-safe enum definitions (Prisma Client cannot be used in browser)
// These match the enums from Prisma schema
const EducationLevel = {
  HIGH_SCHOOL: 'HIGH_SCHOOL',
  COLLEGE: 'COLLEGE',
  POST_GRAD: 'POST_GRAD',
  ELEMENTARY: 'ELEMENTARY',
  MIDDLE_SCHOOL: 'MIDDLE_SCHOOL',
} as const

const GradeLevel = {
  FRESHMAN: 'FRESHMAN',
  SOPHOMORE: 'SOPHOMORE',
  JUNIOR: 'JUNIOR',
  SENIOR: 'SENIOR',
  KINDERGARTEN: 'KINDERGARTEN',
  GRADE_1: 'GRADE_1',
  GRADE_2: 'GRADE_2',
  GRADE_3: 'GRADE_3',
  GRADE_4: 'GRADE_4',
  GRADE_5: 'GRADE_5',
  GRADE_6: 'GRADE_6',
  GRADE_7: 'GRADE_7',
  GRADE_8: 'GRADE_8',
  GRADE_9: 'GRADE_9',
  GRADE_10: 'GRADE_10',
  GRADE_11: 'GRADE_11',
  GRADE_12: 'GRADE_12',
} as const

type EducationLevel = (typeof EducationLevel)[keyof typeof EducationLevel]
type GradeLevel = (typeof GradeLevel)[keyof typeof GradeLevel]

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
    educationLevel: student.educationLevel || FORM_DEFAULTS.NONE,
    gradeLevel: student.gradeLevel || FORM_DEFAULTS.NONE,
    schoolName: student.schoolName || FORM_DEFAULTS.EMPTY,
    monthlyRate: student.monthlyRate ?? 150,
    customRate: student.customRate ?? false,
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
    educationLevel: isNoneValue(formData.educationLevel)
      ? null
      : (formData.educationLevel as EducationLevel),
    gradeLevel: isNoneValue(formData.gradeLevel)
      ? null
      : (formData.gradeLevel as GradeLevel),
    schoolName: formData.schoolName || null,
    monthlyRate: formData.monthlyRate,
    customRate: formData.customRate,
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

  // Monthly rate must be non-negative
  if (formData.monthlyRate < 0) {
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
    formData.educationLevel !== originalData.educationLevel ||
    formData.gradeLevel !== originalData.gradeLevel ||
    formData.schoolName !== originalData.schoolName ||
    formData.monthlyRate !== originalData.monthlyRate ||
    formData.customRate !== originalData.customRate ||
    formData.batchId !== originalData.batchId
  )
}

/**
 * Format education level for display
 * Uses shared formatEnumValue utility to convert UPPER_SNAKE_CASE to Title Case
 */
export function formatEducationLevel(level: string | null | undefined): string {
  return formatEnumValue(level ?? null)
}

/**
 * Format grade level for display
 * Uses shared formatEnumValue utility to convert UPPER_SNAKE_CASE to Title Case
 */
export function formatGradeLevel(grade: string | null | undefined): string {
  return formatEnumValue(grade ?? null)
}
