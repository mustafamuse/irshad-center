import { useCallback, useMemo, useRef, useTransition } from 'react'

import { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import { createClientLogger } from '@/lib/logger-client'

interface SafeActionResultShape<TValues extends FieldValues, TData> {
  data?: TData
  serverError?: string
  validationErrors?: Partial<Record<keyof TValues | string, unknown>>
}

interface UseSafeActionFormOptions<TValues extends FieldValues, TData> {
  form: UseFormReturn<TValues>
  action: (
    values: TValues
  ) => Promise<SafeActionResultShape<TValues, TData> | undefined>
  onSuccess?: (data: TData) => void | Promise<void>
  onError?: () => void
  validationErrorToast?: string | null
  exceptionToast?: string
  loggerName?: string
}

interface UseSafeActionFormReturn<TValues extends FieldValues> {
  execute: (values: TValues) => void
  isPending: boolean
}

export function useSafeActionForm<TValues extends FieldValues, TData>({
  form,
  action,
  onSuccess,
  onError,
  validationErrorToast = null,
  exceptionToast = 'Something went wrong. Please try again.',
  loggerName = 'mahad-safe-action-form',
}: UseSafeActionFormOptions<TValues, TData>): UseSafeActionFormReturn<TValues> {
  const [isPending, startTransition] = useTransition()
  const logger = useMemo(() => createClientLogger(loggerName), [loggerName])
  const inFlightRef = useRef(false)

  const execute = useCallback(
    (values: TValues) => {
      if (isPending || inFlightRef.current) return

      inFlightRef.current = true

      startTransition(async () => {
        try {
          const result = await action(values)

          if (result?.validationErrors) {
            for (const [field, fieldErrors] of Object.entries(
              result.validationErrors
            )) {
              const errors = fieldErrors as { _errors?: string[] } | undefined
              const message = errors?._errors?.[0]
              if (message) {
                form.setError(field as FieldPath<TValues>, {
                  type: 'manual',
                  message,
                })
              }
            }

            if (validationErrorToast) {
              toast.error(validationErrorToast)
            }
            onError?.()
            return
          }

          if (result?.serverError) {
            toast.error(result.serverError)
            onError?.()
            return
          }

          if (result?.data !== undefined) {
            await onSuccess?.(result.data)
          }
        } catch (error) {
          logger.error('Safe-action submit error:', error)
          toast.error(error instanceof Error ? error.message : exceptionToast)
          onError?.()
        } finally {
          inFlightRef.current = false
        }
      })
    },
    [
      action,
      exceptionToast,
      form,
      isPending,
      logger,
      onError,
      onSuccess,
      validationErrorToast,
    ]
  )

  return { execute, isPending }
}
