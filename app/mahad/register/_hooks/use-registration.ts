import { useState, useCallback } from 'react'

import { useRouter } from 'next/navigation'

import { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import { createClientLogger } from '@/lib/logger-client'
import { MahadRegistrationValues as StudentFormValues } from '@/lib/registration/schemas/registration'

import { registerStudent as registerStudentAction } from '../_actions'

const logger = createClientLogger('mahad-registration')

interface UseRegistrationProps {
  form: UseFormReturn<StudentFormValues>
}

export function useRegistration({ form }: UseRegistrationProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const registerStudent = useCallback(
    async (formData: StudentFormValues) => {
      if (isSubmitting) return

      setIsSubmitting(true)

      try {
        const result = await registerStudentAction(formData)

        if (!result.success) {
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
            toast.error(result.error)
          } else {
            toast.error(
              result.error || 'Registration failed. Please try again.'
            )
          }
          return
        }

        toast.success('Registration complete!')
        form.reset()
        router.push(
          `/mahad/register/success?name=${encodeURIComponent(result.data.name)}`
        )
      } catch (error) {
        logger.error('Registration error:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Registration failed. Please try again.'
        )
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, form, router]
  )

  return {
    registerStudent,
    isSubmitting,
  }
}
