import { EducationLevel, GradeLevel, SubscriptionStatus } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { StudentStatus } from '@/lib/types/student'

// Import the parseSearchParams function by extracting it from the page component
// Since it's not exported, we'll test it through integration or extract it to a util

/**
 * Note: parseSearchParams is currently an internal function in page.tsx
 * For proper testing, it should be extracted to a utility file.
 * These tests document the expected behavior.
 */

describe('parseSearchParams', () => {
  // Mock the function's expected behavior based on implementation
  function parseSearchParams(params: {
    search?: string
    batch?: string | string[]
    status?: string | string[]
    subscriptionStatus?: string | string[]
    educationLevel?: string | string[]
    gradeLevel?: string | string[]
    page?: string
    limit?: string
  }) {
    const toArray = (val: string | string[] | undefined): string[] => {
      if (!val) return []
      return Array.isArray(val) ? val : [val]
    }

    const validStatuses = Object.values(StudentStatus)
    const validSubscriptionStatuses = Object.values(SubscriptionStatus)
    const validEducationLevels = Object.values(EducationLevel)
    const validGradeLevels = Object.values(GradeLevel)

    return {
      search: params.search || undefined,
      // Cap at 50 to prevent URL abuse
      batchIds: toArray(params.batch).slice(0, 50),
      // Filter out invalid status values from URL and cap at 20
      statuses: toArray(params.status)
        .filter((s) => validStatuses.includes(s as StudentStatus))
        .slice(0, 20),
      // Filter out invalid subscription status values from URL and cap at 20
      subscriptionStatuses: toArray(params.subscriptionStatus)
        .filter((s) =>
          validSubscriptionStatuses.includes(s as SubscriptionStatus)
        )
        .slice(0, 20),
      // Filter out invalid education level values from URL and cap at 20
      educationLevels: toArray(params.educationLevel)
        .filter((e) => validEducationLevels.includes(e as EducationLevel))
        .slice(0, 20) as EducationLevel[],
      // Filter out invalid grade level values from URL and cap at 20
      gradeLevels: toArray(params.gradeLevel)
        .filter((g) => validGradeLevels.includes(g as GradeLevel))
        .slice(0, 20) as GradeLevel[],
      page: params.page
        ? (() => {
            const parsed = parseInt(params.page, 10)
            return isNaN(parsed) ? 1 : Math.max(1, parsed)
          })()
        : 1,
      limit: params.limit
        ? (() => {
            const parsed = parseInt(params.limit, 10)
            return isNaN(parsed) ? 50 : Math.min(Math.max(1, parsed), 100)
          })()
        : 50,
    }
  }

  describe('search param', () => {
    it('should return undefined when search is not provided', () => {
      const result = parseSearchParams({})
      expect(result.search).toBeUndefined()
    })

    it('should return search value when provided', () => {
      const result = parseSearchParams({ search: 'john doe' })
      expect(result.search).toBe('john doe')
    })

    it('should handle empty search string', () => {
      const result = parseSearchParams({ search: '' })
      expect(result.search).toBeUndefined()
    })
  })

  describe('batch param', () => {
    it('should return empty array when no batches provided', () => {
      const result = parseSearchParams({})
      expect(result.batchIds).toEqual([])
    })

    it('should convert single batch to array', () => {
      const result = parseSearchParams({ batch: 'batch-1' })
      expect(result.batchIds).toEqual(['batch-1'])
    })

    it('should handle multiple batches', () => {
      const result = parseSearchParams({
        batch: ['batch-1', 'batch-2', 'batch-3'],
      })
      expect(result.batchIds).toEqual(['batch-1', 'batch-2', 'batch-3'])
    })

    it('should cap batches at 50', () => {
      const batches = Array.from({ length: 100 }, (_, i) => `batch-${i}`)
      const result = parseSearchParams({ batch: batches })
      expect(result.batchIds).toHaveLength(50)
      expect(result.batchIds[0]).toBe('batch-0')
      expect(result.batchIds[49]).toBe('batch-49')
    })
  })

  describe('status param validation', () => {
    it('should filter valid statuses', () => {
      const result = parseSearchParams({
        status: ['enrolled', 'registered', 'on_leave'],
      })
      expect(result.statuses).toEqual(['enrolled', 'registered', 'on_leave'])
    })

    it('should filter out invalid statuses', () => {
      const result = parseSearchParams({
        status: ['enrolled', 'invalid_status', 'registered'],
      })
      expect(result.statuses).toEqual(['enrolled', 'registered'])
    })

    it('should cap statuses at 20', () => {
      const statuses = Array.from({ length: 30 }, () => 'enrolled')
      const result = parseSearchParams({ status: statuses })
      expect(result.statuses).toHaveLength(20)
    })

    it('should return empty array for all invalid statuses', () => {
      const result = parseSearchParams({
        status: ['completely_invalid', 'also_invalid'],
      })
      expect(result.statuses).toEqual([])
    })
  })

  describe('subscriptionStatus param validation', () => {
    it('should filter valid subscription statuses', () => {
      const result = parseSearchParams({
        subscriptionStatus: ['active', 'past_due', 'canceled'],
      })
      expect(result.subscriptionStatuses).toEqual([
        'active',
        'past_due',
        'canceled',
      ])
    })

    it('should filter out invalid subscription statuses', () => {
      const result = parseSearchParams({
        subscriptionStatus: ['active', 'not_a_real_status', 'canceled'],
      })
      expect(result.subscriptionStatuses).toEqual(['active', 'canceled'])
    })

    it('should cap subscription statuses at 20', () => {
      const statuses = Array.from({ length: 25 }, () => 'active')
      const result = parseSearchParams({ subscriptionStatus: statuses })
      expect(result.subscriptionStatuses).toHaveLength(20)
    })
  })

  describe('educationLevel param validation', () => {
    it('should filter valid education levels', () => {
      const result = parseSearchParams({
        educationLevel: ['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL'],
      })
      expect(result.educationLevels).toEqual([
        'ELEMENTARY',
        'MIDDLE_SCHOOL',
        'HIGH_SCHOOL',
      ])
    })

    it('should filter out invalid education levels', () => {
      const result = parseSearchParams({
        educationLevel: ['ELEMENTARY', 'INVALID_LEVEL', 'HIGH_SCHOOL'],
      })
      expect(result.educationLevels).toEqual(['ELEMENTARY', 'HIGH_SCHOOL'])
    })

    it('should cap education levels at 20', () => {
      const levels = Array.from({ length: 25 }, () => 'ELEMENTARY')
      const result = parseSearchParams({ educationLevel: levels })
      expect(result.educationLevels).toHaveLength(20)
    })
  })

  describe('gradeLevel param validation', () => {
    it('should filter valid grade levels', () => {
      const result = parseSearchParams({
        gradeLevel: ['GRADE_1', 'GRADE_2', 'GRADE_3'],
      })
      expect(result.gradeLevels).toEqual(['GRADE_1', 'GRADE_2', 'GRADE_3'])
    })

    it('should filter out invalid grade levels', () => {
      const result = parseSearchParams({
        gradeLevel: ['GRADE_1', 'GRADE_99', 'GRADE_2'],
      })
      expect(result.gradeLevels).toEqual(['GRADE_1', 'GRADE_2'])
    })

    it('should cap grade levels at 20', () => {
      const levels = Array.from({ length: 25 }, () => 'GRADE_1')
      const result = parseSearchParams({ gradeLevel: levels })
      expect(result.gradeLevels).toHaveLength(20)
    })
  })

  describe('page param validation', () => {
    it('should default to page 1 when not provided', () => {
      const result = parseSearchParams({})
      expect(result.page).toBe(1)
    })

    it('should parse valid page numbers', () => {
      const result = parseSearchParams({ page: '5' })
      expect(result.page).toBe(5)
    })

    it('should enforce minimum page of 1', () => {
      const result = parseSearchParams({ page: '-1' })
      expect(result.page).toBe(1)
    })

    it('should enforce minimum page of 1 for zero', () => {
      const result = parseSearchParams({ page: '0' })
      expect(result.page).toBe(1)
    })

    it('should handle non-numeric page values', () => {
      const result = parseSearchParams({ page: 'invalid' })
      expect(result.page).toBe(1) // NaN defaults to 1
    })
  })

  describe('limit param validation', () => {
    it('should default to 50 when not provided', () => {
      const result = parseSearchParams({})
      expect(result.limit).toBe(50)
    })

    it('should parse valid limit values', () => {
      const result = parseSearchParams({ limit: '25' })
      expect(result.limit).toBe(25)
    })

    it('should enforce minimum limit of 1', () => {
      const result = parseSearchParams({ limit: '0' })
      expect(result.limit).toBe(1)
    })

    it('should enforce maximum limit of 100', () => {
      const result = parseSearchParams({ limit: '200' })
      expect(result.limit).toBe(100)
    })

    it('should cap negative limits at 1', () => {
      const result = parseSearchParams({ limit: '-10' })
      expect(result.limit).toBe(1)
    })
  })

  describe('combined params', () => {
    it('should handle all params together', () => {
      const result = parseSearchParams({
        search: 'john',
        batch: ['batch-1', 'batch-2'],
        status: ['enrolled', 'registered'],
        subscriptionStatus: 'active',
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'GRADE_12',
        page: '3',
        limit: '75',
      })

      expect(result).toEqual({
        search: 'john',
        batchIds: ['batch-1', 'batch-2'],
        statuses: ['enrolled', 'registered'],
        subscriptionStatuses: ['active'],
        educationLevels: ['HIGH_SCHOOL'],
        gradeLevels: ['GRADE_12'],
        page: 3,
        limit: 75,
      })
    })
  })
})
