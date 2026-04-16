import { useCallback, useTransition } from 'react'

import { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import { createClientLogger } from '@/lib/logger-client'

/**
 * Minimal structural shape of a `next-safe-action` result we care about
 * on the client. Keeping this local avoids pulling runtime types from
 * `next-safe-action` into the hook's public API.
 */
interface SafeActionResultShape<TValues extends FieldValues, TData> {
  data?: TData
  serverError?: string
  validationErrors?: Partial<Record<keyof TValues | string, unknown>>
}

interface UseSafeActionFormOptions<TValues extends FieldValues, TData> {
  form: UseFormReturn<TValues>
  /**
   * Server action to execute. Must be a function that takes the form values
   * and returns a `next-safe-action`-shaped result (or `undefined`, which
   * the safe-action client returns when the action is filtered out).
   */
  action: (
    values: TValues
  ) => Promise<SafeActionResultShape<TValues, TData> | undefined>
  /** Called with `data` when the action succeeds (no validation/server errors). */
  onSuccess?: (data: TData) => void | Promise<void>
  /**
   * Invoked after `validationErrors`, `serverError`, or an exception so
   * callers can reset feature-local state (e.g. the lookup result). Not
   * called on success.
   */
  onError?: () => void
  /**
   * Summary toast shown after mapping validation errors onto the form.
   * Pass `null` (or omit) to suppress the toast (useful when field-level
   * error messages already make the problem obvious, e.g. a 4-digit phone).
   */
  validationErrorToast?: string | null
  /** Toast shown when the action itself throws. */
  exceptionToast?: string
  /** Logger namespace used for unexpected exceptions. */
  loggerName?: string
}

interface UseSafeActionFormReturn<TValues extends FieldValues> {
  execute: (values: TValues) => void
  isPending: boolean
}

/**
 * Client-side helper that wraps the repeated `next-safe-action` +
 * `react-hook-form` submit pattern used across Mahad public pages:
 *
 * - Wraps the call in `useTransition` so the button can render a pending state.
 * - Guards against double-submits (no-op if already pending).
 * - Maps `validationErrors` onto `form.setError(field, { type: 'manual', message })`
 *   for every `_errors[0]` present.
 * - Toasts `serverError` messages (and optionally a summary after validation errors).
 * - Invokes `onSuccess(data)` only when the action returns `data`.
 * - Logs and toasts thrown errors.
 *
 * Unlike `hooks/use-action-handler.ts`, this hook understands
 * `validationErrors` and does NOT treat them as successful outcomes.
 */
export function useSafeActionForm<
  TValues extends FieldValues,
  TData,
>({
  form,
  action,
  onSuccess,
  onError,
  validationErrorToast = null,
  exceptionToast,
  loggerName = 'mahad-safe-action-form',
}: UseSafeActionFormOptions<TValues, TData>): UseSafeActionFormReturn<TValues> {
  const [isPending, startTransition] = useTransition()

  const execute = useCallback(
    (values: TValues) => {
      if (isPending) return
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
            if (validationErrorToast) toast.error(validationErrorToast)
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
          const logger = createClientLogger(loggerName)
          logger.error('Safe-action submit error:', error)
          toast.error(
            error instanceof Error
              ? error.message
              : (exceptionToast ?? 'Something went wrong. Please try again.')
          )
          onError?.()
        }
      })
    },
    [
      action,
      form,
      isPending,
      loggerName,
      onError,
      onSuccess,
      validationErrorToast,
      exceptionToast,
    ]
  )

  return { execute, isPending }
}
