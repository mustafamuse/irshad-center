import { useState, useCallback } from 'react'

import { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import {
  MahadRegistrationValues as StudentFormValues,
  type SearchResult,
} from '@/lib/registration/schemas/registration'

import { registerStudent as registerStudentAction } from '../_actions'

interface RegistrationResult {
  studentCount: number
  profileId: string
  studentName: string
}

interface UseRegistrationProps {
  form: UseFormReturn<StudentFormValues>
  onSuccess: (result: RegistrationResult) => void
}

export function useRegistration({ form, onSuccess }: UseRegistrationProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const registerStudent = useCallback(
    async (formData: StudentFormValues, siblings: SearchResult[]) => {
      if (isSubmitting) return

      setIsSubmitting(true)

      const successMessage =
        siblings.length > 0
          ? `Registration complete! Successfully enrolled ${siblings.length + 1} students.`
          : 'Registration complete! Successfully enrolled 1 student.'

      const registrationPromise = registerStudentAction({
        studentData: formData,
        siblingIds: siblings.length > 0 ? siblings.map((s) => s.id) : null,
      })

      try {
        const result = await registrationPromise

        if (!result.success) {
          // If error has a specific field, show it under that field
          // Note: field property is only available when service returns field-specific errors
          const field = 'field' in result ? result.field : undefined
          if (
            field &&
            typeof field === 'string' &&
            (field === 'email' ||
              field === 'phone' ||
              field === 'firstName' ||
              field === 'lastName' ||
              field === 'dateOfBirth')
          ) {
            form.setError(field, {
              type: 'manual',
              message: result.error ?? 'Validation error',
            })
            // Also show toast for visibility
            toast.error(result.error)
          } else {
            // General error, just show toast
            toast.error(
              result.error || 'Registration failed. Please try again.'
            )
          }
          return
        }

        toast.success(successMessage)
        form.reset()
        onSuccess({
          studentCount: siblings.length + 1,
          profileId: result.data.id,
          studentName: result.data.name,
        })
      } catch (error) {
        console.error('Registration error:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Registration failed. Please try again.'
        )
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, form, onSuccess]
  )

  return {
    registerStudent,
    isSubmitting,
  }
}
