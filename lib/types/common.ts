/**
 * Common Type Definitions
 *
 * Shared interfaces and types used across the application.
 * These reduce duplication and ensure consistency.
 */

// ============================================================================
// Base Record Types
// ============================================================================

/**
 * Base interface for all database records with timestamps
 *
 * Usage:
 * ```typescript
 * interface MyRecord extends BaseTimestamps {
 *   id: string
 *   name: string
 * }
 * ```
 */
export interface BaseTimestamps {
  createdAt: Date
  updatedAt: Date
}

/**
 * Base interface for database records with ID and timestamps
 */
export interface BaseRecord extends BaseTimestamps {
  id: string
}

// ============================================================================
// Status Types
// ============================================================================

/**
 * Type guard to check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Make selected properties optional in a type
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Make selected properties required in a type
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

/**
 * Extract the element type from an array type
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Standard pagination parameters
 */
export interface PaginationParams {
  page?: number
  limit?: number
}

/**
 * Standard pagination response metadata
 */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard success response
 */
export interface SuccessResponse<T = void> {
  success: true
  data: T
}

/**
 * Standard error response
 */
export interface ErrorResponse {
  success: false
  error: string
  code?: string
  details?: Record<string, unknown>
}

/**
 * Union type for API responses
 */
export type ApiResponse<T = void> = SuccessResponse<T> | ErrorResponse

/**
 * Type guard for success response
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is SuccessResponse<T> {
  return response.success === true
}

/**
 * Type guard for error response
 */
export function isErrorResponse(
  response: ApiResponse<unknown>
): response is ErrorResponse {
  return response.success === false
}
