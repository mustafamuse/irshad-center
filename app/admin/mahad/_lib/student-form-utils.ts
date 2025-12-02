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
} from '../_types'

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

function isValidEmail(email: string): boolean {
  if (!email) return true
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function isValidPhone(phone: string): boolean {
  if (!phone) return true
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 11
}

export function isFormValid(formData: StudentFormData): boolean {
  if (!formData.name || formData.name.trim() === '') {
    return false
  }

  if (formData.email && !isValidEmail(formData.email)) {
    return false
  }

  if (formData.phone && !isValidPhone(formData.phone)) {
    return false
  }

  return true
}

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

export function formatGradeLevel(grade: string | null): string {
  return formatEnumValue(grade)
}

export function formatGraduationStatus(status: string | null): string {
  return formatEnumValue(status)
}

export function formatBillingType(type: string | null): string {
  return formatEnumValue(type)
}
