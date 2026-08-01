import { useTransition, useCallback } from 'react'

import { useRouter } from 'next/navigation'

import { FieldPath, UseFormReturn } from 'react-hook-form'
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
  const [isSubmitting, startTransition] = useTransition()
  const router = useRouter()

  const registerStudent = useCallback(
    (formData: MahadRegistrationValues) => {
      startTransition(async () => {
        try {
          const result = await registerStudentAction(formData)

          if (result?.validationErrors) {
            for (const [field, fieldErrors] of Object.entries(result.validationErrors)) {
              const errors = fieldErrors as { _errors?: string[] }
              if (errors._errors?.[0]) {
                form.setError(field as FieldPath<MahadRegistrationValues>, {
                  type: 'manual',
                  message: errors._errors[0],
                })
              }
            }
            toast.error('Please correct the errors above.')
            return
          }

          if (result?.serverError) {
            toast.error(result.serverError)
            return
          }

          if (result?.data) {
            toast.success('Registration complete!')
            form.reset()
            router.push(
              `/mahad/register/success?name=${encodeURIComponent(result.data.name)}`
            )
          }
        } catch (error) {
          logger.error('Registration error:', error)
          toast.error(
            error instanceof Error
              ? error.message
              : 'Registration failed. Please try again.'
          )
        }
      })
    },
    [form, router]
  )

  return {
    registerStudent,
    isSubmitting,
  }
}
