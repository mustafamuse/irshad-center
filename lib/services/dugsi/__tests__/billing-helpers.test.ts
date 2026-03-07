import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockBillingAssignmentFindFirst, mockLogError } = vi.hoisted(() => ({
  mockBillingAssignmentFindFirst: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    billingAssignment: {
      findFirst: (...args: unknown[]) =>
        mockBillingAssignmentFindFirst(...args),
    },
  },
}))

vi.mock('@/lib/constants/dugsi', () => ({
  DUGSI_PROGRAM: 'DUGSI_PROGRAM',
}))

vi.mock('@/lib/logger', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

import {
  findFamilySubscription,
  handleBillingDivergence,
} from '../billing-helpers'

describe('findFamilySubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when familyReferenceId is null', async () => {
    const result = await findFamilySubscription(null)

    expect(result).toBeNull()
    expect(mockBillingAssignmentFindFirst).not.toHaveBeenCalled()
  })

  it('should return subscription when active assignment exists', async () => {
    const subscription = {
      id: 'sub-1',
      stripeSubscriptionId: 'sub_stripe_1',
      status: 'active',
      amount: 8000,
    }
    mockBillingAssignmentFindFirst.mockResolvedValueOnce({ subscription })

    const result = await findFamilySubscription('family-1')

    expect(result).toEqual(subscription)
    expect(mockBillingAssignmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          programProfile: expect.objectContaining({
            familyReferenceId: 'family-1',
          }),
          subscription: expect.objectContaining({
            status: { in: ['active', 'paused'] },
          }),
        }),
        include: { subscription: true },
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('should return null when no active assignment exists', async () => {
    mockBillingAssignmentFindFirst.mockResolvedValueOnce(null)

    const result = await findFamilySubscription('family-1')

    expect(result).toBeNull()
  })

  it('should filter by DUGSI stripe account type', async () => {
    mockBillingAssignmentFindFirst.mockResolvedValueOnce(null)

    await findFamilySubscription('family-1')

    expect(mockBillingAssignmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subscription: expect.objectContaining({
            stripeAccountType: 'DUGSI',
          }),
        }),
      })
    )
  })
})

describe('handleBillingDivergence', () => {
  const mockLogger = { info: vi.fn(), error: vi.fn() } as never

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log CRITICAL error and return formatted message', async () => {
    const dbError = new Error('Connection refused')
    const context = { subscriptionId: 'sub_1', operation: 'cancel' }

    const result = await handleBillingDivergence(
      mockLogger,
      dbError,
      'Stripe subscription canceled',
      context
    )

    expect(result).toBe(
      'Stripe subscription canceled but DB update failed: Connection refused'
    )
    expect(mockLogError).toHaveBeenCalledWith(
      mockLogger,
      dbError,
      'CRITICAL: Stripe subscription canceled but DB update failed - states diverged',
      context
    )
  })

  it('should handle non-Error objects', async () => {
    const result = await handleBillingDivergence(
      mockLogger,
      'string error',
      'Stripe paused',
      {}
    )

    expect(result).toBe('Stripe paused but DB update failed: Unknown error')
  })
})
