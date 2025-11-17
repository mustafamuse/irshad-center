/**
 * Pagination and Filtering Constants
 *
 * Central configuration for page sizes, limits, and constraints
 * used across the cohorts management system.
 */

/**
 * Pagination limits for students table and filtering
 */
export const PAGINATION_LIMITS = {
  /** Default number of items per page */
  DEFAULT_PAGE_SIZE: 50,
  /** Maximum allowed items per page (prevents URL abuse) */
  MAX_PAGE_SIZE: 100,
  /** Minimum items per page */
  MIN_PAGE_SIZE: 1,
  /** Maximum number of batch filters in URL (prevents URL abuse) */
  MAX_BATCH_FILTERS: 50,
  /** Maximum number of enum filters (status, education level, etc.) */
  MAX_ENUM_FILTERS: 20,
} as const

/**
 * Loading skeleton counts for consistent UI
 */
export const SKELETON_COUNTS = {
  /** Number of skeleton rows in students table loading state */
  STUDENT_ROWS: 10,
  /** Number of skeleton cards in batch grid loading state */
  BATCH_CARDS: 6,
} as const
