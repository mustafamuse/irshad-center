import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockPrismaFindFirst, mockLogError } = vi.hoisted(() => ({
  mockPrismaFindFirst: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    billingAssignment: {
      findFirst: (...args: unknown[]) => mockPrismaFindFirst(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

import { LIVE_SUBSCRIPTION_STATUSES } from '@/lib/db/query-builders'

import {
  findFamilySubscription,
  handleBillingDivergence,
} from '../billing-helpers'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('findFamilySubscription', () => {
  it('should return null when familyReferenceId is null', async () => {
    const result = await findFamilySubscription(null)
    expect(result).toBeNull()
    expect(mockPrismaFindFirst).not.toHaveBeenCalled()
  })

  it('should return null when no matching assignment exists', async () => {
    mockPrismaFindFirst.mockResolvedValueOnce(null)

    const result = await findFamilySubscription('family-uuid-123')
    expect(result).toBeNull()
  })

  it('should return the subscription when a matching assignment exists', async () => {
    const mockSubscription = {
      id: 'sub-db-id',
      stripeSubscriptionId: 'sub_stripe123',
      status: 'active',
    }
    mockPrismaFindFirst.mockResolvedValueOnce({
      subscription: mockSubscription,
    })

    const result = await findFamilySubscription('family-uuid-123')

    expect(result).toEqual(mockSubscription)
    expect(mockPrismaFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          programProfile: expect.objectContaining({
            familyReferenceId: 'family-uuid-123',
          }),
          subscription: expect.objectContaining({
            status: {
              in: [...LIVE_SUBSCRIPTION_STATUSES, 'paused'],
            },
          }),
        }),
        include: { subscription: true },
      })
    )
  })
})

describe('handleBillingDivergence', () => {
  it('should log a critical error and return a descriptive message', async () => {
    const mockLogger = { error: vi.fn() } as unknown as Parameters<
      typeof handleBillingDivergence
    >[0]
    const dbError = new Error('Connection refused')

    const result = await handleBillingDivergence(
      mockLogger,
      dbError,
      'Stripe paused',
      {
        familyReferenceId: 'fam-123',
        stripeSubscriptionId: 'sub_abc',
        intendedStatus: 'paused',
      }
    )

    expect(result).toContain('Stripe paused')
    expect(result).toContain('DB update failed')
    expect(result).toContain('Connection refused')
    expect(mockLogError).toHaveBeenCalledWith(
      mockLogger,
      dbError,
      expect.stringContaining('CRITICAL'),
      expect.objectContaining({ familyReferenceId: 'fam-123' })
    )
  })

  it('should handle non-Error objects gracefully', async () => {
    const mockLogger = { error: vi.fn() } as unknown as Parameters<
      typeof handleBillingDivergence
    >[0]

    const result = await handleBillingDivergence(
      mockLogger,
      'string error',
      'Stripe resumed',
      {}
    )

    expect(result).toContain('Stripe resumed')
    expect(result).toContain('Unknown error')
  })
})
