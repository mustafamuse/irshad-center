import { useState, useCallback } from 'react'

import { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import {
  MahadRegistrationValues as StudentFormValues,
  type SearchResult,
} from '@/lib/registration/schemas/registration'

import { registerStudent as registerStudentAction } from '../actions'

interface UseRegistrationProps {
  form: UseFormReturn<StudentFormValues>
  onSuccess: (studentCount: number) => void
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
          if (result.field) {
            form.setError(result.field, {
              type: 'manual',
              message: result.error,
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
        onSuccess(siblings.length + 1)
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
