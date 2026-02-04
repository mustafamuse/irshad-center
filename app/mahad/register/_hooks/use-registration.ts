import { useState, useCallback } from 'react'

import { useRouter } from 'next/navigation'

import { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import { createClientLogger } from '@/lib/logger-client'
import type { MahadRegistrationValues } from '@/lib/registration/schemas/registration'

import { registerStudent as registerStudentAction } from '../_actions'

const logger = createClientLogger('mahad-registration')

export function useRegistration({
  form,
}: {
  form: UseFormReturn<MahadRegistrationValues>
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const registerStudent = useCallback(
    async (formData: MahadRegistrationValues) => {
      if (isSubmitting) return

      setIsSubmitting(true)

      try {
        const result = await registerStudentAction(formData)

        if (!result.success) {
          if (result.errors) {
            const fieldNames = [
              'email',
              'phone',
              'firstName',
              'lastName',
              'dateOfBirth',
            ] as const
            for (const field of fieldNames) {
              const messages = result.errors[field]
              if (messages?.[0]) {
                form.setError(field, {
                  type: 'manual',
                  message: messages[0],
                })
              }
            }
          }
          toast.error(result.error || 'Registration failed. Please try again.')
          return
        }

        toast.success('Registration complete!')
        form.reset()
        const name = result.data?.name ?? ''
        router.push(`/mahad/register/success?name=${encodeURIComponent(name)}`)
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
