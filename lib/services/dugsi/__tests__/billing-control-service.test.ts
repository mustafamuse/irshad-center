import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockFindFamilySubscription,
  mockHandleBillingDivergence,
  mockStripeSubscriptionUpdate,
  mockPrismaSubscriptionUpdate,
  mockLogInfo,
} = vi.hoisted(() => ({
  mockFindFamilySubscription: vi.fn(),
  mockHandleBillingDivergence: vi.fn(),
  mockStripeSubscriptionUpdate: vi.fn(),
  mockPrismaSubscriptionUpdate: vi.fn(),
  mockLogInfo: vi.fn(),
}))

vi.mock('../billing-helpers', () => ({
  findFamilySubscription: (...args: unknown[]) =>
    mockFindFamilySubscription(...args),
  handleBillingDivergence: (...args: unknown[]) =>
    mockHandleBillingDivergence(...args),
}))

vi.mock('@/lib/stripe-dugsi', () => ({
  getDugsiStripeClient: vi.fn(() => ({
    subscriptions: {
      update: (...args: unknown[]) => mockStripeSubscriptionUpdate(...args),
    },
  })),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    subscription: {
      update: (...args: unknown[]) => mockPrismaSubscriptionUpdate(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  logInfo: (...args: unknown[]) => mockLogInfo(...args),
}))

vi.mock('@/lib/errors/action-error', async () => {
  const actual = await vi.importActual('@/lib/errors/action-error')
  return actual
})

vi.mock('@sentry/nextjs', () => ({
  startSpan: (_opts: unknown, fn: () => unknown) => fn(),
}))

import { ActionError } from '@/lib/errors/action-error'

import {
  pauseFamilyBilling,
  resumeFamilyBilling,
} from '../billing-control-service'

beforeEach(() => {
  vi.clearAllMocks()
})

const MOCK_SUBSCRIPTION = {
  id: 'db-sub-id',
  stripeSubscriptionId: 'sub_stripe123',
  status: 'active',
}

const MOCK_PAUSED_SUBSCRIPTION = {
  ...MOCK_SUBSCRIPTION,
  status: 'paused',
}

// ============================================================================
// pauseFamilyBilling
// ============================================================================

describe('pauseFamilyBilling', () => {
  it('should throw ActionError when no subscription found', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(null)

    const promise = pauseFamilyBilling('fam-123')
    await expect(promise).rejects.toThrow(ActionError)
    await expect(promise).rejects.toThrow(/no active subscription/i)
    expect(mockStripeSubscriptionUpdate).not.toHaveBeenCalled()
  })

  it('should throw ActionError when subscription is not active', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce({
      ...MOCK_SUBSCRIPTION,
      status: 'paused',
    })

    const promise = pauseFamilyBilling('fam-123')
    await expect(promise).rejects.toThrow(ActionError)
    await expect(promise).rejects.toThrow(/cannot pause/i)
  })

  it('should pause Stripe subscription with void behavior', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})
    mockPrismaSubscriptionUpdate.mockResolvedValueOnce({})

    const result = await pauseFamilyBilling('fam-123')

    expect(result.success).toBe(true)
    expect(mockStripeSubscriptionUpdate).toHaveBeenCalledWith('sub_stripe123', {
      pause_collection: { behavior: 'void' },
    })
  })

  it('should update DB status to paused after Stripe success', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})
    mockPrismaSubscriptionUpdate.mockResolvedValueOnce({})

    await pauseFamilyBilling('fam-123')

    expect(mockPrismaSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'db-sub-id' },
        data: { status: 'paused' },
      })
    )
  })

  it('should log success after completing', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})
    mockPrismaSubscriptionUpdate.mockResolvedValueOnce({})

    await pauseFamilyBilling('fam-123')

    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('paused'),
      expect.objectContaining({ familyReferenceId: 'fam-123' })
    )
  })

  it('should handle DB divergence when Stripe succeeds but DB fails', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})
    mockPrismaSubscriptionUpdate.mockRejectedValueOnce(
      new Error('DB connection lost')
    )
    mockHandleBillingDivergence.mockResolvedValueOnce(
      'Stripe paused but DB update failed: DB connection lost'
    )

    const result = await pauseFamilyBilling('fam-123')

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB update failed')
    expect(mockHandleBillingDivergence).toHaveBeenCalled()
  })
})

// ============================================================================
// resumeFamilyBilling
// ============================================================================

describe('resumeFamilyBilling', () => {
  it('should throw ActionError when no subscription found', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(null)

    await expect(resumeFamilyBilling('fam-123')).rejects.toThrow(ActionError)
    expect(mockStripeSubscriptionUpdate).not.toHaveBeenCalled()
  })

  it('should throw ActionError when subscription is not paused', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)

    const promise = resumeFamilyBilling('fam-123')
    await expect(promise).rejects.toThrow(ActionError)
    await expect(promise).rejects.toThrow(/cannot resume/i)
  })

  it('should resume Stripe subscription by clearing pause_collection', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_PAUSED_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})
    mockPrismaSubscriptionUpdate.mockResolvedValueOnce({})

    const result = await resumeFamilyBilling('fam-123')

    expect(result.success).toBe(true)
    expect(mockStripeSubscriptionUpdate).toHaveBeenCalledWith('sub_stripe123', {
      pause_collection: null,
    })
  })

  it('should update DB status to active after Stripe success', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_PAUSED_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})
    mockPrismaSubscriptionUpdate.mockResolvedValueOnce({})

    await resumeFamilyBilling('fam-123')

    expect(mockPrismaSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'db-sub-id' },
        data: { status: 'active' },
      })
    )
  })

  it('should handle DB divergence when Stripe succeeds but DB fails', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_PAUSED_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})
    mockPrismaSubscriptionUpdate.mockRejectedValueOnce(new Error('Timeout'))
    mockHandleBillingDivergence.mockResolvedValueOnce(
      'Stripe resumed but DB update failed: Timeout'
    )

    const result = await resumeFamilyBilling('fam-123')

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB update failed')
  })
})
