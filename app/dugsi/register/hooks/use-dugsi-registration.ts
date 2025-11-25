import { useTransition, useCallback } from 'react'

import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import { createClientLogger } from '@/lib/logger-client'
import type { DugsiRegistrationValues } from '@/lib/registration/schemas/registration'

import { registerDugsiChildren } from '../actions'

const logger = createClientLogger('useDugsiRegistration')

interface UseDugsiRegistrationProps {
  form: UseFormReturn<DugsiRegistrationValues>
  onSuccess?: (data: {
    children: Array<{ id: string; name: string }>
    count: number
    paymentUrl?: string
    familyId?: string
  }) => void
}

export function useDugsiRegistration({
  form,
  onSuccess,
}: UseDugsiRegistrationProps) {
  const t = useTranslations('dugsi')
  const [isPending, startTransition] = useTransition()

  const registerChildren = useCallback(
    async (formData: DugsiRegistrationValues) => {
      if (isPending) return

      logger.debug('Starting registration', {
        childCount: formData.children.length,
      })

      startTransition(async () => {
        try {
          const result = await registerDugsiChildren(formData)
          logger.debug('Server action result', result)

          if (!result.success) {
            // Handle validation errors
            if (result.errors) {
              // Set field errors if available
              Object.entries(result.errors).forEach(([field, messages]) => {
                if (messages && messages.length > 0) {
                  form.setError(field as keyof DugsiRegistrationValues, {
                    type: 'manual',
                    message: messages[0],
                  })
                }
              })
            }

            // Show error toast
            toast.error(result.error || t('messages.enrollmentError'))
            return
          }

          // Success handling
          if (result.data?.paymentUrl) {
            logger.info('Registration successful! Redirecting to payment')

            // Show informative message before redirect
            const childText =
              formData.children.length === 1
                ? t('childrenSection.child')
                : t('childrenSection.children')

            toast.success(
              `Registration saved for ${formData.children.length} ${childText}. Redirecting to complete payment...`,
              {
                duration: 2500,
              }
            )

            // Call onSuccess callback if provided
            if (onSuccess && result.data) {
              onSuccess(result.data)
            }

            // Redirect to Stripe payment
            setTimeout(() => {
              window.location.href = result.data!.paymentUrl!
            }, 1500) // Brief delay to show message
          } else {
            // Success without payment URL
            const childText =
              formData.children.length === 1
                ? t('childrenSection.child')
                : t('childrenSection.children')

            toast.success(
              `Registration complete! Successfully enrolled ${formData.children.length} ${childText}.`
            )

            // Call onSuccess callback if provided
            if (onSuccess && result.data) {
              onSuccess(result.data)
            }

            // Optionally reset form
            form.reset()
          }
        } catch (error) {
          logger.error('Unexpected error during registration', error)
          toast.error(
            error instanceof Error
              ? error.message
              : t('messages.unexpectedError')
          )
        }
      })
    },
    [isPending, form, onSuccess, t]
  )

  return {
    registerChildren,
    isPending,
  }
}
