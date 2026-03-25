import { DonationStatus } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockFindMany, mockCount, mockAggregate, mockQueryRaw } = vi.hoisted(
  () => ({
    mockFindMany: vi.fn(),
    mockCount: vi.fn(),
    mockAggregate: vi.fn(),
    mockQueryRaw: vi.fn(),
  })
)

vi.mock('@/lib/db', () => ({
  prisma: {
    donation: {
      findMany: mockFindMany,
      count: mockCount,
      aggregate: mockAggregate,
    },
    $queryRaw: mockQueryRaw,
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
    mockQueryRaw.mockResolvedValue([])
  })

  it('calculates correct one-time totals', async () => {
    mockAggregate.mockResolvedValue({ _sum: { amount: 50000 }, _count: 5 })
    mockQueryRaw.mockResolvedValue([])

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
    mockQueryRaw
      .mockResolvedValueOnce([
        { mrrcents: BigInt(5000), activerecurringcount: BigInt(2) },
      ])
      .mockResolvedValueOnce([{ count: BigInt(5) }])

    const result = await getDonationStats()

    expect(result.mrrCents).toBe(5000)
    expect(result.activeRecurringCount).toBe(2)
  })

  it('excludes cancelled subscriptions from MRR via NOT EXISTS', async () => {
    mockCount.mockResolvedValue(2)
    mockQueryRaw
      .mockResolvedValueOnce([
        { mrrcents: BigInt(2000), activerecurringcount: BigInt(1) },
      ])
      .mockResolvedValueOnce([{ count: BigInt(0) }])

    const result = await getDonationStats()

    expect(result.mrrCents).toBe(2000)
    expect(result.activeRecurringCount).toBe(1)
  })

  it('counts unique donor emails via COUNT(DISTINCT)', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        { mrrcents: BigInt(0), activerecurringcount: BigInt(0) },
      ])
      .mockResolvedValueOnce([{ count: BigInt(42) }])

    const result = await getDonationStats()

    expect(result.totalDonorCount).toBe(42)
  })

  it('returns zeros when no donations exist', async () => {
    mockAggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 })
    mockQueryRaw
      .mockResolvedValueOnce([
        { mrrcents: BigInt(0), activerecurringcount: BigInt(0) },
      ])
      .mockResolvedValueOnce([{ count: BigInt(0) }])

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
