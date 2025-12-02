import { useCallback, useEffect, useState } from 'react'

import type { BatchStudentData, StudentDetailData } from '@/lib/types/batch'

import {
  convertFormDataToPayload,
  getDefaultFormData,
  hasFormChanges,
  isFormValid,
} from '../_lib/student-form-utils'
import type { StudentFormData, UpdateStudentPayload } from '../_types'

export interface UseStudentFormReturn {
  /** Current form data state */
  formData: StudentFormData
  /** Update a specific form field */
  updateField: <K extends keyof StudentFormData>(
    field: K,
    value: StudentFormData[K]
  ) => void
  /** Reset form to original student data */
  reset: () => void
  /** Convert form data to API payload format */
  toPayload: () => UpdateStudentPayload
  /** Whether the form is valid for submission */
  isValid: boolean
  /** Whether the form has unsaved changes */
  hasChanges: boolean
}

/**
 * useStudentForm - Form state management hook for student editing
 *
 * Manages form state, validation, and change detection for student data.
 * Automatically resets form when the dialog opens with new student data.
 *
 * @param student - Student data to initialize form from
 * @param open - Whether the form dialog is open (triggers reset on open)
 * @returns Form state and actions
 *
 * @example
 * ```tsx
 * const { formData, updateField, isValid, hasChanges } = useStudentForm(student, isOpen)
 *
 * <Input
 *   value={formData.name}
 *   onChange={(e) => updateField('name', e.target.value)}
 * />
 * ```
 */
export function useStudentForm(
  student: BatchStudentData | StudentDetailData,
  open: boolean
): UseStudentFormReturn {
  const [formData, setFormData] = useState<StudentFormData>(() =>
    getDefaultFormData(student)
  )

  const updateField = useCallback(
    <K extends keyof StudentFormData>(field: K, value: StudentFormData[K]) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }))
    },
    []
  )

  const reset = useCallback(() => {
    setFormData(getDefaultFormData(student))
  }, [student])

  const toPayload = useCallback((): UpdateStudentPayload => {
    return convertFormDataToPayload(formData)
  }, [formData])

  const isValid = isFormValid(formData)
  const hasChanges = hasFormChanges(formData, student)

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
