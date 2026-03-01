import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockFindMany, mockCount, mockAggregate } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockAggregate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    donation: {
      findMany: mockFindMany,
      count: mockCount,
      aggregate: mockAggregate,
    },
  },
}))

import {
  getDonations,
  getDonationStats,
  getRecurringDonations,
} from '../donation'

const EMPTY_AGGREGATE = { _sum: { amount: 0 }, _count: 0 }

function mockStatsDefaults() {
  mockAggregate.mockResolvedValue(EMPTY_AGGREGATE)
  mockCount.mockResolvedValue(0)
  mockFindMany.mockResolvedValue([])
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getDonations', () => {
  it('returns paginated results with defaults (page 1, pageSize 25)', async () => {
    const mockDonations = [
      { id: 'don-1', amount: 5000, donorEmail: 'a@test.com' },
      { id: 'don-2', amount: 10000, donorEmail: 'b@test.com' },
    ]
    mockFindMany.mockResolvedValue(mockDonations)
    mockCount.mockResolvedValue(2)

    const result = await getDonations()

    expect(result).toEqual({
      donations: mockDonations,
      total: 2,
      page: 1,
      pageSize: 25,
    })
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      take: 25,
      skip: 0,
    })
    expect(mockCount).toHaveBeenCalledWith({ where: {} })
  })

  it('filters by status when provided', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await getDonations({ status: 'succeeded' })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'succeeded' },
      })
    )
    expect(mockCount).toHaveBeenCalledWith({ where: { status: 'succeeded' } })
  })

  it('filters by isRecurring when provided', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await getDonations({ isRecurring: true })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isRecurring: true },
      })
    )
    expect(mockCount).toHaveBeenCalledWith({ where: { isRecurring: true } })
  })

  it('applies correct skip/take for pagination', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(100)

    const result = await getDonations({ page: 3, pageSize: 10 })

    expect(result).toEqual(expect.objectContaining({ page: 3, pageSize: 10 }))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 })
    )
  })
})

describe('getDonationStats', () => {
  it('calculates correct one-time totals', async () => {
    mockStatsDefaults()
    mockAggregate.mockResolvedValue({ _sum: { amount: 50000 }, _count: 5 })

    const result = await getDonationStats()

    expect(result.oneTimeTotalCents).toBe(50000)
    expect(result.oneTimeCount).toBe(5)
    expect(mockAggregate).toHaveBeenCalledWith({
      where: { status: 'succeeded', isRecurring: false },
      _sum: { amount: true },
      _count: true,
    })
  })

  it('calculates MRR from latest payment per active subscription', async () => {
    mockAggregate.mockResolvedValue(EMPTY_AGGREGATE)
    mockCount.mockResolvedValue(3)
    mockFindMany
      .mockResolvedValueOnce([
        { stripeSubscriptionId: 'sub_1', amount: 2000 },
        { stripeSubscriptionId: 'sub_1', amount: 1500 },
        { stripeSubscriptionId: 'sub_2', amount: 3000 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await getDonationStats()

    expect(result.mrrCents).toBe(5000)
    expect(result.activeRecurringCount).toBe(2)
  })

  it('excludes cancelled subscriptions from MRR', async () => {
    mockAggregate.mockResolvedValue(EMPTY_AGGREGATE)
    mockCount.mockResolvedValue(2)
    mockFindMany
      .mockResolvedValueOnce([
        { stripeSubscriptionId: 'sub_active', amount: 2000 },
        { stripeSubscriptionId: 'sub_cancelled', amount: 5000 },
      ])
      .mockResolvedValueOnce([{ stripeSubscriptionId: 'sub_cancelled' }])
      .mockResolvedValueOnce([])

    const result = await getDonationStats()

    expect(result.mrrCents).toBe(2000)
    expect(result.activeRecurringCount).toBe(1)
  })

  it('counts unique donor emails', async () => {
    mockAggregate.mockResolvedValue(EMPTY_AGGREGATE)
    mockCount.mockResolvedValue(0)
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { donorEmail: 'a@test.com' },
        { donorEmail: 'b@test.com' },
        { donorEmail: 'c@test.com' },
      ])

    const result = await getDonationStats()

    expect(result.totalDonorCount).toBe(3)
  })

  it('returns zeros when no donations exist', async () => {
    mockAggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 })
    mockCount.mockResolvedValue(0)
    mockFindMany.mockResolvedValue([])

    const result = await getDonationStats()

    expect(result).toEqual({
      oneTimeTotalCents: 0,
      oneTimeCount: 0,
      activeRecurringCount: 0,
      mrrCents: 0,
      totalDonorCount: 0,
      recurringPaymentCount: 0,
    })
  })
})

describe('getRecurringDonations', () => {
  it('returns only succeeded recurring donations with subscriptionId', async () => {
    const mockRecurring = [
      {
        id: 'don-1',
        isRecurring: true,
        status: 'succeeded',
        stripeSubscriptionId: 'sub_1',
      },
      {
        id: 'don-2',
        isRecurring: true,
        status: 'succeeded',
        stripeSubscriptionId: 'sub_2',
      },
    ]
    mockFindMany.mockResolvedValue(mockRecurring)

    const result = await getRecurringDonations()

    expect(result).toEqual(mockRecurring)
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        isRecurring: true,
        status: 'succeeded',
        stripeSubscriptionId: { not: null },
      },
      orderBy: { paidAt: 'desc' },
    })
  })
})
