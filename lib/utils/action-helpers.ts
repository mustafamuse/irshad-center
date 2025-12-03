/**
 * Action Helper Utilities
 *
 * Shared utilities for server actions to reduce boilerplate
 * and standardize error handling patterns.
 */

import { createActionLogger, logError } from '@/lib/logger'

const logger = createActionLogger('action-helpers')

/**
 * Generic action result type for consistent response structure
 */
export type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  message?: string
  errors?: Partial<Record<string, string[]>>
}

/**
 * Wraps an async function with standardized error handling.
 *
 * Eliminates try-catch boilerplate and ensures consistent error format
 * across all server actions.
 *
 * @param fn - Async function to execute
 * @param errorMessage - Default error message if function throws
 * @returns ActionResult with success/error state
 *
 * @example
 * ```typescript
 * export async function myAction(id: string) {
 *   return withActionError(
 *     async () => {
 *       const data = await someService(id)
 *       return data
 *     },
 *     'Failed to perform action'
 *   )
 * }
 * ```
 */
export async function withActionError<T>(
  fn: () => Promise<T>,
  errorMessage: string
): Promise<ActionResult<T>> {
  try {
    const data = await fn()
    return {
      success: true,
      data,
    }
  } catch (error) {
    await logError(logger, error, errorMessage)
    return {
      success: false,
      error: error instanceof Error ? error.message : errorMessage,
    }
  }
}

/**
 * Validates that a value is not null or undefined.
 *
 * @param value - Value to check
 * @param errorMessage - Error message if validation fails
 * @throws Error if value is null or undefined
 */
export function assertExists<T>(
  value: T | null | undefined,
  errorMessage: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(errorMessage)
  }
}

/**
 * Validates that an array is not empty.
 *
 * @param array - Array to check
 * @param errorMessage - Error message if validation fails
 * @throws Error if array is empty
 */
export function assertNotEmpty<T>(
  array: T[],
  errorMessage: string
): asserts array is [T, ...T[]] {
  if (array.length === 0) {
    throw new Error(errorMessage)
  }
}
