'use client'

import { useAction } from 'next-safe-action/hooks'
import type { HookCallbacks, HookSafeActionFn } from 'next-safe-action/hooks'
import type { Schema } from 'next-safe-action/adapters/types'

/**
 * Normalized result shape matching ActionResult<T> used by existing callsites.
 */
export type ActionHandlerResult<T> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * Wraps next-safe-action's useAction hook and returns an ActionResult-compatible
 * result shape, preserving existing client callsite patterns.
 */
export function useActionHandler<
  ServerError,
  S extends Schema | undefined,
  const BAS extends readonly Schema[],
  CVE,
  CBAVE,
  Data,
>(
  safeActionFn: HookSafeActionFn<ServerError, S, BAS, CVE, CBAVE, Data>,
  callbacks?: HookCallbacks<ServerError, S, BAS, CVE, CBAVE, Data>
) {
  const {
    execute,
    executeAsync,
    result,
    reset,
    isPending,
    hasSucceeded,
    hasErrored,
  } = useAction(safeActionFn, callbacks)

  const normalizedResult: ActionHandlerResult<Data> = {
    success: hasSucceeded && !result.serverError,
    data: result.data,
    error: result.serverError as string | undefined,
  }

  return {
    execute,
    executeAsync,
    result: normalizedResult,
    reset,
    isPending,
    hasSucceeded,
    hasErrored,
  }
}
