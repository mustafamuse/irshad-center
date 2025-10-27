import { EducationLevel, GradeLevel } from '@prisma/client'

import type { BatchStudentData } from '@/lib/types/batch'

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
 * Check if form data is valid
 */
export function isFormValid(formData: StudentFormData): boolean {
  // Name is required
  if (!formData.name || formData.name.trim() === '') {
    return false
  }

  // Monthly rate must be non-negative
  if (formData.monthlyRate < 0) {
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
 */
export function formatEducationLevel(level: string | null): string {
  if (!level) return 'Not specified'

  return level
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Format grade level for display
 */
export function formatGradeLevel(grade: string | null): string {
  if (!grade) return 'Not specified'

  return grade
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Format phone number for display (basic formatting)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')

  // Format as (XXX) XXX-XXXX for 10-digit numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }

  // Return as-is if not 10 digits
  return phone
}
