import { useCallback, useEffect, useState } from 'react'

import type { BatchStudentData } from '@/lib/types/batch'

import {
  convertFormDataToPayload,
  getDefaultFormData,
  hasFormChanges,
  isFormValid,
} from '../lib/student-form-utils'
import type {
  StudentFormData,
  UpdateStudentPayload,
} from '../types/student-form'

export interface UseStudentFormReturn {
  formData: StudentFormData
  updateField: <K extends keyof StudentFormData>(
    field: K,
    value: StudentFormData[K]
  ) => void
  reset: () => void
  toPayload: () => UpdateStudentPayload
  isValid: boolean
  hasChanges: boolean
}

/**
 * Custom hook for managing student form state
 * Handles initialization, updates, validation, and conversion to API payload
 *
 * @param student - The student record being edited
 * @param open - Whether the form dialog is open
 * @returns Form state and helper functions
 */
export function useStudentForm(
  student: BatchStudentData,
  open: boolean
): UseStudentFormReturn {
  // Initialize form data from student
  const [formData, setFormData] = useState<StudentFormData>(() =>
    getDefaultFormData(student)
  )

  // Generic field update handler
  const updateField = useCallback(
    <K extends keyof StudentFormData>(field: K, value: StudentFormData[K]) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }))
    },
    []
  )

  // Reset form to student's current values
  const reset = useCallback(() => {
    setFormData(getDefaultFormData(student))
  }, [student])

  // Convert form data to API payload
  const toPayload = useCallback((): UpdateStudentPayload => {
    return convertFormDataToPayload(formData)
  }, [formData])

  // Check if form is valid
  const isValid = isFormValid(formData)

  // Check if form has changes from original
  const hasChanges = hasFormChanges(formData, student)

  // Auto-reset when dialog opens or student changes
  useEffect(() => {
    if (open) {
      setFormData(getDefaultFormData(student))
    }
  }, [student, open])

  return {
    formData,
    updateField,
    reset,
    toPayload,
    isValid,
    hasChanges,
  }
}
