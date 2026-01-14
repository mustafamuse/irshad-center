'use client'

import { useTransition } from 'react'

import { useRouter } from 'next/navigation'

import * as Sentry from '@sentry/nextjs'
import { toast } from 'sonner'

import { ActionResult } from '../_types'

interface UseActionHandlerOptions<T> {
  onSuccess?: (data?: T) => void
  onError?: (error: string) => void
  successMessage?: string
  errorMessage?: string
  refreshOnSuccess?: boolean
  optimisticUpdate?: () => void
  rollback?: () => void
}

export function useActionHandler<T = void, TArgs extends unknown[] = never[]>(
  action: (...args: TArgs) => Promise<ActionResult<T>>,
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

        if (result.success) {
          const message =
            result.message || successMessage || 'Action completed successfully'
          toast.success(message)

          if (refreshOnSuccess) {
            router.refresh()
          }

          onSuccess?.(result.data)
        } else {
          rollback?.()
          const message = result.error || errorMessage || 'Action failed'
          toast.error(message)
          onError?.(result.error || 'Unknown error')
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
