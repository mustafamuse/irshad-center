import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockProgramProfileCount,
  mockProgramProfileFindMany,
  mockProgramProfileGroupBy,
  mockBillingAccountCount,
  mockSubscriptionFindMany,
  mockDugsiClassEnrollmentCount,
} = vi.hoisted(() => ({
  mockProgramProfileCount: vi.fn(),
  mockProgramProfileFindMany: vi.fn(),
  mockProgramProfileGroupBy: vi.fn(),
  mockBillingAccountCount: vi.fn(),
  mockSubscriptionFindMany: vi.fn(),
  mockDugsiClassEnrollmentCount: vi.fn(),
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@sentry/nextjs', () => ({
  startSpan: (_config: unknown, fn: () => unknown) => fn(),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({}),
  logError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      count: (...args: unknown[]) => mockProgramProfileCount(...args),
      findMany: (...args: unknown[]) => mockProgramProfileFindMany(...args),
      groupBy: (...args: unknown[]) => mockProgramProfileGroupBy(...args),
    },
    billingAccount: {
      count: (...args: unknown[]) => mockBillingAccountCount(...args),
    },
    subscription: {
      findMany: (...args: unknown[]) => mockSubscriptionFindMany(...args),
    },
    dugsiClassEnrollment: {
      count: (...args: unknown[]) => mockDugsiClassEnrollmentCount(...args),
    },
  },
}))

import { getDugsiInsights } from '../insights-service'

function setupDefaultMocks() {
  mockProgramProfileCount.mockImplementation(
    ({ where }: { where: Record<string, unknown> }) => {
      if (!where.status) return Promise.resolve(10)
      return Promise.resolve(5)
    }
  )

  mockProgramProfileFindMany.mockImplementation(
    ({ where }: { where: Record<string, unknown> }) => {
      if (where.createdAt) return Promise.resolve([])
      return Promise.resolve([])
    }
  )

  mockProgramProfileGroupBy.mockImplementation(({ by }: { by: string[] }) => {
    if (by[0] === 'familyReferenceId') return Promise.resolve([])
    return Promise.resolve([])
  })

  mockBillingAccountCount.mockResolvedValue(0)
  mockSubscriptionFindMany.mockResolvedValue([])
  mockDugsiClassEnrollmentCount.mockResolvedValue(0)
}

beforeEach(() => {
  vi.clearAllMocks()
  setupDefaultMocks()
})

describe('getDugsiInsights', () => {
  describe('family status breakdown', () => {
    it('picks best status across siblings in a family', async () => {
      mockProgramProfileFindMany.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) => {
          if (where.createdAt) return Promise.resolve([])
          return Promise.resolve([
            {
              familyReferenceId: 'FAM-1',
              assignments: [{ subscription: { status: 'active' } }],
            },
            {
              familyReferenceId: 'FAM-1',
              assignments: [],
            },
          ])
        }
      )

      const result = await getDugsiInsights()
      expect(result.health.familyStatusBreakdown.active).toBe(1)
      expect(result.health.familyStatusBreakdown.none).toBe(0)
      expect(result.health.totalFamilies).toBe(1)
    })

    it('prioritizes active over past_due across siblings', async () => {
      mockProgramProfileFindMany.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) => {
          if (where.createdAt) return Promise.resolve([])
          return Promise.resolve([
            {
              familyReferenceId: 'FAM-2',
              assignments: [{ subscription: { status: 'past_due' } }],
            },
            {
              familyReferenceId: 'FAM-2',
              assignments: [{ subscription: { status: 'active' } }],
            },
          ])
        }
      )

      const result = await getDugsiInsights()
      expect(result.health.familyStatusBreakdown.active).toBe(1)
      expect(result.health.familyStatusBreakdown.past_due).toBe(0)
    })

    it('counts profiles without familyReferenceId as separate families', async () => {
      mockProgramProfileFindMany.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) => {
          if (where.createdAt) return Promise.resolve([])
          return Promise.resolve([
            {
              id: 'profile-solo-1',
              familyReferenceId: null,
              assignments: [{ subscription: { status: 'active' } }],
            },
            {
              id: 'profile-solo-2',
              familyReferenceId: null,
              assignments: [{ subscription: { status: 'canceled' } }],
            },
          ])
        }
      )

      const result = await getDugsiInsights()
      expect(result.health.familyStatusBreakdown.active).toBe(1)
      expect(result.health.familyStatusBreakdown.canceled).toBe(1)
      expect(result.health.totalFamilies).toBe(2)
    })

    it('classifies family as none when no children have subscriptions', async () => {
      mockProgramProfileFindMany.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) => {
          if (where.createdAt) return Promise.resolve([])
          return Promise.resolve([
            { familyReferenceId: 'FAM-3', assignments: [] },
            { familyReferenceId: 'FAM-3', assignments: [] },
          ])
        }
      )

      const result = await getDugsiInsights()
      expect(result.health.familyStatusBreakdown.none).toBe(1)
      expect(result.health.familyStatusBreakdown.active).toBe(0)
    })
  })

  describe('revenue deduplication', () => {
    it('counts expected revenue once per family with split payments', async () => {
      mockSubscriptionFindMany.mockResolvedValue([
        {
          id: 'sub-1',
          amount: 8000,
          assignments: [{ programProfile: { familyReferenceId: 'FAM-3' } }],
        },
        {
          id: 'sub-2',
          amount: 8000,
          assignments: [{ programProfile: { familyReferenceId: 'FAM-3' } }],
        },
      ])

      mockProgramProfileGroupBy.mockImplementation(
        ({ by }: { by: string[] }) => {
          if (by[0] === 'familyReferenceId') {
            return Promise.resolve([
              { familyReferenceId: 'FAM-3', _count: { id: 2 } },
            ])
          }
          return Promise.resolve([])
        }
      )

      const result = await getDugsiInsights()
      expect(result.revenue.monthlyRevenue).toBe(16000)
      expect(result.revenue.expectedRevenue).toBe(16000)
      expect(result.revenue.variance).toBe(0)
      expect(result.revenue.mismatchCount).toBe(0)
      expect(result.revenue.revenueByTier).toEqual([
        {
          tier: '2 children',
          childCount: 2,
          familyCount: 1,
          expectedRevenue: 16000,
          actualRevenue: 16000,
        },
      ])
    })

    it('detects mismatch when split payment total differs from expected', async () => {
      mockSubscriptionFindMany.mockResolvedValue([
        {
          id: 'sub-3',
          amount: 5000,
          assignments: [{ programProfile: { familyReferenceId: 'FAM-4' } }],
        },
        {
          id: 'sub-4',
          amount: 5000,
          assignments: [{ programProfile: { familyReferenceId: 'FAM-4' } }],
        },
      ])

      mockProgramProfileGroupBy.mockImplementation(
        ({ by }: { by: string[] }) => {
          if (by[0] === 'familyReferenceId') {
            return Promise.resolve([
              { familyReferenceId: 'FAM-4', _count: { id: 2 } },
            ])
          }
          return Promise.resolve([])
        }
      )

      const result = await getDugsiInsights()
      expect(result.revenue.monthlyRevenue).toBe(10000)
      expect(result.revenue.expectedRevenue).toBe(16000)
      expect(result.revenue.variance).toBe(-6000)
      expect(result.revenue.mismatchCount).toBe(1)
    })

    it('handles single-subscription family correctly', async () => {
      mockSubscriptionFindMany.mockResolvedValue([
        {
          id: 'sub-5',
          amount: 23000,
          assignments: [{ programProfile: { familyReferenceId: 'FAM-5' } }],
        },
      ])

      mockProgramProfileGroupBy.mockImplementation(
        ({ by }: { by: string[] }) => {
          if (by[0] === 'familyReferenceId') {
            return Promise.resolve([
              { familyReferenceId: 'FAM-5', _count: { id: 3 } },
            ])
          }
          return Promise.resolve([])
        }
      )

      const result = await getDugsiInsights()
      expect(result.revenue.monthlyRevenue).toBe(23000)
      expect(result.revenue.expectedRevenue).toBe(23000)
      expect(result.revenue.mismatchCount).toBe(0)
      expect(result.revenue.revenueByTier).toEqual([
        {
          tier: '3 children',
          childCount: 3,
          familyCount: 1,
          expectedRevenue: 23000,
          actualRevenue: 23000,
        },
      ])
    })
  })

  describe('error handling', () => {
    it('propagates query errors through logError', async () => {
      const { logError } = await import('@/lib/logger')
      const dbError = new Error('connection refused')
      mockProgramProfileCount.mockRejectedValue(dbError)

      await expect(getDugsiInsights()).rejects.toThrow('connection refused')
      expect(logError).toHaveBeenCalled()
    })
  })
})
