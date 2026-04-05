'use client'

import { useTransition } from 'react'

import { useRouter } from 'next/navigation'

import * as Sentry from '@sentry/nextjs'
import { toast } from 'sonner'

type MaybeResult =
  | { data?: unknown; serverError?: string; validationErrors?: unknown }
  | undefined

interface UseActionHandlerOptions<T> {
  onSuccess?: (data?: T) => void
  onError?: (error: string) => void
  successMessage?: string
  errorMessage?: string
  refreshOnSuccess?: boolean
  optimisticUpdate?: () => void
  rollback?: () => void
}

export function useActionHandler<
  T = unknown,
  TArgs extends unknown[] = never[],
>(
  action: (...args: TArgs) => Promise<MaybeResult>,
  options: UseActionHandlerOptions<T> = {}
) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const {
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    refreshOnSuccess = true,
    optimisticUpdate,
    rollback,
  } = options

  const execute = async (...args: TArgs) => {
    optimisticUpdate?.()

    startTransition(async () => {
      try {
        const result = await action(...args)

        if (result !== undefined && !result.serverError) {
          const dataMessage =
            result.data &&
            typeof result.data === 'object' &&
            'message' in result.data
              ? (result.data as { message?: string }).message
              : undefined
          const dataWarning =
            result.data &&
            typeof result.data === 'object' &&
            'warning' in result.data
              ? (result.data as { warning?: string }).warning
              : undefined
          const message =
            dataMessage || successMessage || 'Action completed successfully'
          toast.success(message)
          if (dataWarning) {
            toast.warning(dataWarning)
          }

          if (refreshOnSuccess) {
            router.refresh()
          }

          onSuccess?.(result.data as T)
        } else {
          rollback?.()
          const message = result?.serverError || errorMessage || 'Action failed'
          toast.error(message)
          onError?.(result?.serverError || 'Unknown error')
        }
      } catch (error) {
        rollback?.()
        Sentry.captureException(error, {
          tags: { component: 'useActionHandler' },
        })
        const message =
          errorMessage || 'An unexpected error occurred. Please try again.'
        toast.error(message)
        onError?.(error instanceof Error ? error.message : 'Unknown error')
      }
    })
  }

  return {
    execute,
    isPending,
  }
}
