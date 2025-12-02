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
