import { EducationLevel, GradeLevel } from '@prisma/client'

import type { BatchStudentData } from '@/lib/types/batch'
import { formatEnumValue } from '@/lib/utils/formatters'

import {
  FORM_DEFAULTS,
  isNoneValue,
  type StudentFormData,
  type UpdateStudentPayload,
} from '../types/student-form'

/**
 * Get default form data from student record
 * Converts null/undefined to appropriate form defaults
 */
export function getDefaultFormData(student: BatchStudentData): StudentFormData {
  return {
    name: student.name,
    email: student.email || FORM_DEFAULTS.EMPTY,
    phone: student.phone || FORM_DEFAULTS.EMPTY,
    dateOfBirth: student.dateOfBirth,
    educationLevel: student.educationLevel || FORM_DEFAULTS.NONE,
    gradeLevel: student.gradeLevel || FORM_DEFAULTS.NONE,
    schoolName: student.schoolName || FORM_DEFAULTS.EMPTY,
    monthlyRate: student.monthlyRate,
    customRate: student.customRate,
    batchId: student.batchId || FORM_DEFAULTS.NONE,
  }
}

/**
 * Convert form data to API payload
 * Handles 'none' placeholder conversion to undefined
 */
export function convertFormDataToPayload(
  formData: StudentFormData
): UpdateStudentPayload {
  return {
    name: formData.name,
    email: formData.email || undefined,
    phone: formData.phone || undefined,
    dateOfBirth: formData.dateOfBirth || undefined,
    educationLevel: isNoneValue(formData.educationLevel)
      ? undefined
      : (formData.educationLevel as EducationLevel),
    gradeLevel: isNoneValue(formData.gradeLevel)
      ? undefined
      : (formData.gradeLevel as GradeLevel),
    schoolName: formData.schoolName || undefined,
    monthlyRate: formData.monthlyRate,
    customRate: formData.customRate,
    batchId: isNoneValue(formData.batchId) ? undefined : formData.batchId,
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
  original: BatchStudentData
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
export function formatEducationLevel(level: string | null): string {
  return formatEnumValue(level)
}

/**
 * Format grade level for display
 * Uses shared formatEnumValue utility to convert UPPER_SNAKE_CASE to Title Case
 */
export function formatGradeLevel(grade: string | null): string {
  return formatEnumValue(grade)
}
