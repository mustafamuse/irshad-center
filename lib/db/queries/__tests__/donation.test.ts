import { DonationStatus } from '@prisma/client'
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

import { getDonations, getDonationStats } from '../donation'

const SYNTHETIC_FILTER = {
  NOT: [
    { stripePaymentIntentId: { startsWith: 'sub_setup_' } },
    { stripePaymentIntentId: { startsWith: 'sub_cancelled_' } },
  ],
}

const EMPTY_AGGREGATE = { _sum: { amount: 0 }, _count: 0 }

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
      where: { ...SYNTHETIC_FILTER },
      orderBy: { createdAt: 'desc' },
      take: 25,
      skip: 0,
    })
    expect(mockCount).toHaveBeenCalledWith({ where: { ...SYNTHETIC_FILTER } })
  })

  it('filters by status when provided', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await getDonations({ status: DonationStatus.succeeded })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: DonationStatus.succeeded, ...SYNTHETIC_FILTER },
      })
    )
    expect(mockCount).toHaveBeenCalledWith({
      where: { status: DonationStatus.succeeded, ...SYNTHETIC_FILTER },
    })
  })

  it('filters by isRecurring when provided', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await getDonations({ isRecurring: true })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isRecurring: true, ...SYNTHETIC_FILTER },
      })
    )
    expect(mockCount).toHaveBeenCalledWith({
      where: { isRecurring: true, ...SYNTHETIC_FILTER },
    })
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
  beforeEach(() => {
    mockAggregate.mockResolvedValue(EMPTY_AGGREGATE)
    mockCount.mockResolvedValue(0)
    mockFindMany.mockResolvedValue([])
  })

  it('calculates correct one-time totals', async () => {
    mockAggregate.mockResolvedValue({ _sum: { amount: 50000 }, _count: 5 })

    const result = await getDonationStats()

    expect(result.oneTimeTotalCents).toBe(50000)
    expect(result.oneTimeCount).toBe(5)
    expect(mockAggregate).toHaveBeenCalledWith({
      where: { status: DonationStatus.succeeded, isRecurring: false },
      _sum: { amount: true },
      _count: true,
    })
  })

  it('calculates MRR from latest payment per active subscription', async () => {
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
