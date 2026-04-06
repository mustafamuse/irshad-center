import { useTransition, useCallback } from 'react'

import { useRouter } from 'next/navigation'

import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import { createClientLogger } from '@/lib/logger-client'
import type { DugsiRegistrationValues } from '@/lib/registration/schemas/registration'

import { registerDugsiChildren } from '../_actions'

const logger = createClientLogger('dugsi-registration')

interface UseDugsiRegistrationProps {
  form: UseFormReturn<DugsiRegistrationValues>
  onSuccess?: (data: {
    children: Array<{ id: string; name: string }>
    count: number
    familyId?: string
  }) => void
}

export function useDugsiRegistration({
  form,
  onSuccess,
}: UseDugsiRegistrationProps) {
  const t = useTranslations('dugsi')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const registerChildren = useCallback(
    async (formData: DugsiRegistrationValues) => {
      if (isPending) return

      startTransition(async () => {
        try {
          const result = await registerDugsiChildren(formData)

          if (result?.validationErrors) {
            for (const [field, fieldErrors] of Object.entries(result.validationErrors)) {
              const errors = fieldErrors as { _errors?: string[] }
              if (errors._errors?.[0]) {
                form.setError(field as keyof DugsiRegistrationValues, {
                  type: 'manual',
                  message: errors._errors[0],
                })
              }
            }
            toast.error(t('messages.enrollmentError'))
            return
          }

          if (result?.serverError) {
            toast.error(result.serverError)
            return
          }

          if (!result?.data) return

          if (onSuccess) {
            onSuccess(result.data)
          }

          router.push(
            `/dugsi/register/success${result.data.familyId ? `?familyId=${result.data.familyId}` : ''}`
          )
        } catch (error) {
          logger.error('Unexpected error during registration:', error)
          toast.error(
            error instanceof Error
              ? error.message
              : t('messages.unexpectedError')
          )
        }
      })
    },
    [form, isPending, onSuccess, router, t]
  )

  return {
    registerChildren,
    isPending,
  }
}
