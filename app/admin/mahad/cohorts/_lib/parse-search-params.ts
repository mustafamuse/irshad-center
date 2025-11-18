import { EducationLevel, GradeLevel, SubscriptionStatus } from '@prisma/client'

import { StudentStatus } from '@/lib/types/student'

import { PAGINATION_LIMITS } from '../constants/pagination'

/**
 * Raw search params as received from Next.js
 */
export type CohortSearchParams = Promise<{
  search?: string
  batch?: string | string[]
  status?: string | string[]
  subscriptionStatus?: string | string[]
  educationLevel?: string | string[]
  gradeLevel?: string | string[]
  page?: string
  limit?: string
}>

/**
 * Parsed and validated search params
 */
export type ParsedCohortSearchParams = {
  search?: string
  batchIds: string[]
  statuses: StudentStatus[]
  subscriptionStatuses: SubscriptionStatus[]
  educationLevels: EducationLevel[]
  gradeLevels: GradeLevel[]
  page: number
  limit: number
}

/**
 * Parse and normalize search params with validation
 *
 * Converts URL search parameters into a type-safe, validated object.
 * Handles:
 * - Array normalization (string | string[] → string[])
 * - Enum validation (filters out invalid values)
 * - Pagination bounds (min/max limits)
 * - URL abuse prevention (caps array sizes)
 *
 * @param params - Raw search params from Next.js
 * @returns Parsed and validated search parameters
 *
 * @example
 * ```ts
 * const params = await searchParams
 * const filters = parseSearchParams(params)
 * // filters.batchIds is always an array, validated and capped
 * ```
 */
export function parseSearchParams(
  params: Awaited<CohortSearchParams>
): ParsedCohortSearchParams {
  // Helper to ensure array
  const toArray = (val: string | string[] | undefined): string[] => {
    if (!val) return []
    return Array.isArray(val) ? val : [val]
  }

  // Validate enum values against actual enum types
  const validStatuses = Object.values(StudentStatus)
  const validSubscriptionStatuses = Object.values(SubscriptionStatus)
  const validEducationLevels = Object.values(EducationLevel)
  const validGradeLevels = Object.values(GradeLevel)

  return {
    search: params.search || undefined,
    // Cap at MAX_BATCH_FILTERS to prevent URL abuse
    batchIds: toArray(params.batch).slice(
      0,
      PAGINATION_LIMITS.MAX_BATCH_FILTERS
    ),
    // Filter out invalid status values from URL and cap at MAX_ENUM_FILTERS
    statuses: toArray(params.status)
      .filter((s) => validStatuses.includes(s as StudentStatus))
      .slice(0, PAGINATION_LIMITS.MAX_ENUM_FILTERS) as StudentStatus[],
    // Filter out invalid subscription status values from URL and cap
    subscriptionStatuses: toArray(params.subscriptionStatus)
      .filter((s) =>
        validSubscriptionStatuses.includes(s as SubscriptionStatus)
      )
      .slice(0, PAGINATION_LIMITS.MAX_ENUM_FILTERS) as SubscriptionStatus[],
    // Filter out invalid education level values from URL and cap
    educationLevels: toArray(params.educationLevel)
      .filter((e) => validEducationLevels.includes(e as EducationLevel))
      .slice(0, PAGINATION_LIMITS.MAX_ENUM_FILTERS) as EducationLevel[],
    // Filter out invalid grade level values from URL and cap
    gradeLevels: toArray(params.gradeLevel)
      .filter((g) => validGradeLevels.includes(g as GradeLevel))
      .slice(0, PAGINATION_LIMITS.MAX_ENUM_FILTERS) as GradeLevel[],
    // Parse page number with validation
    page: params.page
      ? (() => {
          const parsed = parseInt(params.page, 10)
          return isNaN(parsed)
            ? 1
            : Math.max(PAGINATION_LIMITS.MIN_PAGE_SIZE, parsed)
        })()
      : 1,
    // Parse limit with bounds checking
    limit: params.limit
      ? (() => {
          const parsed = parseInt(params.limit, 10)
          return isNaN(parsed)
            ? PAGINATION_LIMITS.DEFAULT_PAGE_SIZE
            : Math.min(
                Math.max(PAGINATION_LIMITS.MIN_PAGE_SIZE, parsed),
                PAGINATION_LIMITS.MAX_PAGE_SIZE
              )
        })()
      : PAGINATION_LIMITS.DEFAULT_PAGE_SIZE,
  }
}
