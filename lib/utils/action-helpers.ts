/**
 * Action Helper Utilities
 *
 * Shared utilities for server actions to reduce boilerplate
 * and standardize error handling patterns.
 */

/**
 * Generic action result type for consistent response structure
 */
export type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  message?: string
  warning?: string
  errors?: Partial<Record<string, string[]>>
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
