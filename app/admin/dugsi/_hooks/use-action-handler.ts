/**
 * Reusable hook for handling server actions with consistent error handling,
 * toast notifications, and router refresh.
 *
 * Eliminates boilerplate code across dialog components.
 */

'use client'

import { useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { toast } from 'sonner'

import { ActionResult } from '../_types'

interface UseActionHandlerOptions<T> {
  /** Callback executed on successful action */
  onSuccess?: (data?: T) => void
  /** Callback executed on failed action */
  onError?: (error: string) => void
  /** Success message to display (falls back to result.message) */
  successMessage?: string
  /** Error message to display (falls back to result.error) */
  errorMessage?: string
  /** Whether to refresh the router on success (default: true) */
  refreshOnSuccess?: boolean
  /** Called before action to optimistically update UI */
  optimisticUpdate?: () => void
  /** Called on error to rollback optimistic update */
  rollback?: () => void
}

/**
 * Hook for handling server actions with automatic toast notifications,
 * error handling, and router refresh.
 *
 * @example
 * ```tsx
 * const { execute: deleteFamily, isPending: isDeleting } = useActionHandler(
 *   deleteDugsiFamily,
 *   {
 *     successMessage: 'Family deleted successfully',
 *     onSuccess: () => {
 *       setShowDialog(false)
 *       resetForm()
 *     }
 *   }
 * )
 *
 * // Call with action parameters
 * await deleteFamily(studentId)
 * ```
 */
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
        console.error('Unexpected action error:', error)
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
