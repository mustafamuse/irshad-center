import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockFindFamilySubscription,
  mockHandleBillingDivergence,
  mockStripeSubscriptionUpdate,
  mockStripeSubscriptionRetrieve,
  mockPrismaProfileUpdateMany,
  mockPrismaAssignmentUpdateMany,
  mockPrismaSubscriptionUpdate,
  mockPrismaProfileFindMany,
  mockLogInfo,
  mockLogWarning,
  mockLogError,
} = vi.hoisted(() => ({
  mockFindFamilySubscription: vi.fn(),
  mockHandleBillingDivergence: vi.fn(),
  mockStripeSubscriptionUpdate: vi.fn(),
  mockStripeSubscriptionRetrieve: vi.fn(),
  mockPrismaProfileUpdateMany: vi.fn(),
  mockPrismaAssignmentUpdateMany: vi.fn(),
  mockPrismaSubscriptionUpdate: vi.fn(),
  mockPrismaProfileFindMany: vi.fn(),
  mockLogInfo: vi.fn(),
  mockLogWarning: vi.fn(),
  mockLogError: vi.fn(),
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
      retrieve: (...args: unknown[]) => mockStripeSubscriptionRetrieve(...args),
    },
  })),
}))

vi.mock('@/lib/keys/stripe', () => ({
  getDugsiKeys: vi.fn(() => ({
    productId: 'prod_test123',
  })),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findMany: (...args: unknown[]) => mockPrismaProfileFindMany(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        programProfile: {
          updateMany: (...args: unknown[]) =>
            mockPrismaProfileUpdateMany(...args),
        },
        billingAssignment: {
          updateMany: (...args: unknown[]) =>
            mockPrismaAssignmentUpdateMany(...args),
        },
      }),
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
  logWarning: (...args: unknown[]) => mockLogWarning(...args),
  logError: (...args: unknown[]) => mockLogError(...args),
}))

vi.mock('@/lib/errors/action-error', async () => {
  const actual = await vi.importActual('@/lib/errors/action-error')
  return actual
})

vi.mock('@sentry/nextjs', () => ({
  startSpan: (_opts: unknown, fn: () => unknown) => fn(),
}))

import { ActionError } from '@/lib/errors/action-error'

import { withdrawChildren } from '../withdrawal-service'

beforeEach(() => {
  vi.clearAllMocks()
  mockPrismaProfileUpdateMany.mockResolvedValue({ count: 1 })
  mockPrismaAssignmentUpdateMany.mockResolvedValue({ count: 1 })
  mockPrismaSubscriptionUpdate.mockResolvedValue({})
})

const FAMILY_ID = 'fam-uuid-123'

function createMockProfiles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `profile-${i + 1}`,
    familyReferenceId: FAMILY_ID,
    program: 'DUGSI_PROGRAM',
    status: 'ENROLLED',
    person: { name: `Child ${i + 1}` },
    assignments: [
      {
        isActive: true,
        subscription: {
          id: 'db-sub-id',
          stripeSubscriptionId: 'sub_stripe123',
          status: 'active',
          amount: 16000,
        },
      },
    ],
  }))
}

const MOCK_SUBSCRIPTION = {
  id: 'db-sub-id',
  stripeSubscriptionId: 'sub_stripe123',
  status: 'active',
  amount: 16000,
}

describe('withdrawChildren', () => {
  it('should throw when no active children found', async () => {
    mockPrismaProfileFindMany.mockResolvedValueOnce([])

    await expect(withdrawChildren(FAMILY_ID, ['profile-1'])).rejects.toThrow(
      ActionError
    )
  })

  it('should throw when profileIds do not belong to family', async () => {
    mockPrismaProfileFindMany.mockResolvedValueOnce(createMockProfiles(2))

    await expect(
      withdrawChildren(FAMILY_ID, ['profile-1', 'nonexistent'])
    ).rejects.toThrow(/not found or not eligible/)
  })

  it('should withdraw single child and update Stripe rate', async () => {
    const profiles = createMockProfiles(2)
    mockPrismaProfileFindMany.mockResolvedValueOnce(profiles)
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ id: 'si_item1' }] },
    })
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})

    const result = await withdrawChildren(FAMILY_ID, ['profile-1'])

    expect(result.success).toBe(true)
    expect(result.withdrawnCount).toBe(1)
    expect(result.remainingCount).toBe(1)
    expect(result.newRate).toBe(8000)
    expect(result.previousRate).toBe(16000)
    expect(result.subscriptionCanceled).toBe(false)

    expect(mockPrismaProfileUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['profile-1'] } },
        data: { status: 'WITHDRAWN' },
      })
    )

    expect(mockPrismaAssignmentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          programProfileId: { in: ['profile-1'] },
          isActive: true,
        },
      })
    )

    expect(mockStripeSubscriptionUpdate).toHaveBeenCalledWith(
      'sub_stripe123',
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 'si_item1',
            price_data: expect.objectContaining({
              unit_amount: 8000,
            }),
          }),
        ],
        proration_behavior: 'none',
      })
    )
  })

  it('should withdraw multiple children in bulk', async () => {
    const profiles = createMockProfiles(3)
    mockPrismaProfileFindMany.mockResolvedValueOnce(profiles)
    mockFindFamilySubscription.mockResolvedValueOnce({
      ...MOCK_SUBSCRIPTION,
      amount: 23000,
    })
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ id: 'si_item1' }] },
    })
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})

    const result = await withdrawChildren(FAMILY_ID, ['profile-1', 'profile-2'])

    expect(result.success).toBe(true)
    expect(result.withdrawnCount).toBe(2)
    expect(result.remainingCount).toBe(1)
    expect(result.newRate).toBe(8000)
    expect(result.previousRate).toBe(23000)
  })

  it('should cancel subscription when all children withdrawn', async () => {
    const profiles = createMockProfiles(2)
    mockPrismaProfileFindMany.mockResolvedValueOnce(profiles)
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})

    const result = await withdrawChildren(FAMILY_ID, ['profile-1', 'profile-2'])

    expect(result.success).toBe(true)
    expect(result.subscriptionCanceled).toBe(true)
    expect(result.remainingCount).toBe(0)

    expect(mockStripeSubscriptionUpdate).toHaveBeenCalledWith('sub_stripe123', {
      cancel_at_period_end: true,
    })
  })

  it('should skip Stripe when subscription is paused (DB-only)', async () => {
    const profiles = createMockProfiles(2)
    mockPrismaProfileFindMany.mockResolvedValueOnce(profiles)
    mockFindFamilySubscription.mockResolvedValueOnce({
      ...MOCK_SUBSCRIPTION,
      status: 'paused',
    })

    const result = await withdrawChildren(FAMILY_ID, ['profile-1'])

    expect(result.success).toBe(true)
    expect(result.remainingCount).toBe(1)
    expect(mockStripeSubscriptionUpdate).not.toHaveBeenCalled()
    expect(mockPrismaSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'db-sub-id' },
        data: { amount: 8000 },
      })
    )
  })

  it('should warn when admin override is reset', async () => {
    const profiles = createMockProfiles(2)
    mockPrismaProfileFindMany.mockResolvedValueOnce(profiles)
    mockFindFamilySubscription.mockResolvedValueOnce({
      ...MOCK_SUBSCRIPTION,
      amount: 10000,
    })
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ id: 'si_item1' }] },
    })
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})

    const result = await withdrawChildren(FAMILY_ID, ['profile-1'])

    expect(result.success).toBe(true)
    expect(result.warning).toContain('override')
    expect(mockLogWarning).toHaveBeenCalled()
  })

  it('should handle DB divergence when Stripe succeeds but DB fails', async () => {
    const profiles = createMockProfiles(2)
    mockPrismaProfileFindMany.mockResolvedValueOnce(profiles)
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ id: 'si_item1' }] },
    })
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})
    mockPrismaSubscriptionUpdate.mockRejectedValueOnce(
      new Error('DB connection lost')
    )
    mockHandleBillingDivergence.mockResolvedValueOnce(
      'Stripe updated to 8000 cents but DB update failed: DB connection lost'
    )

    const result = await withdrawChildren(FAMILY_ID, ['profile-1'])

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB update failed')
    expect(mockHandleBillingDivergence).toHaveBeenCalled()
  })

  it('should work without a subscription (no billing)', async () => {
    const profiles = createMockProfiles(1)
    mockPrismaProfileFindMany.mockResolvedValueOnce(profiles)
    mockFindFamilySubscription.mockResolvedValueOnce(null)

    const result = await withdrawChildren(FAMILY_ID, ['profile-1'])

    expect(result.success).toBe(true)
    expect(result.withdrawnCount).toBe(1)
    expect(mockStripeSubscriptionUpdate).not.toHaveBeenCalled()
  })

  it('should rollback DB when Stripe rate update fails', async () => {
    const profiles = createMockProfiles(2)
    mockPrismaProfileFindMany.mockResolvedValueOnce(profiles)
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ id: 'si_item1' }] },
    })
    mockStripeSubscriptionUpdate.mockRejectedValueOnce(
      new Error('Stripe rate update failed')
    )

    await expect(withdrawChildren(FAMILY_ID, ['profile-1'])).rejects.toThrow(
      'Stripe billing update failed'
    )

    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: 'Stripe rate update failed' }),
      expect.stringContaining('Stripe call failed'),
      expect.objectContaining({ familyReferenceId: FAMILY_ID })
    )

    expect(mockPrismaProfileUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'profile-1' },
        data: { status: 'ENROLLED' },
      })
    )

    expect(mockPrismaAssignmentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programProfileId: { in: ['profile-1'] },
          isActive: false,
        }),
        data: { isActive: true, endDate: null },
      })
    )
  })

  it('should rollback DB when Stripe cancel_at_period_end fails', async () => {
    const profiles = createMockProfiles(2)
    mockPrismaProfileFindMany.mockResolvedValueOnce(profiles)
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockRejectedValueOnce(
      new Error('Stripe cancel failed')
    )

    await expect(
      withdrawChildren(FAMILY_ID, ['profile-1', 'profile-2'])
    ).rejects.toThrow('Stripe billing update failed')

    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: 'Stripe cancel failed' }),
      expect.stringContaining('Stripe call failed'),
      expect.objectContaining({ familyReferenceId: FAMILY_ID })
    )

    expect(mockPrismaProfileUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'profile-1' },
        data: { status: 'ENROLLED' },
      })
    )
    expect(mockPrismaProfileUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'profile-2' },
        data: { status: 'ENROLLED' },
      })
    )

    expect(mockPrismaAssignmentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programProfileId: { in: ['profile-1', 'profile-2'] },
          isActive: false,
        }),
        data: { isActive: true, endDate: null },
      })
    )
  })

  it('should rollback DB when Stripe retrieve fails (no subscription items)', async () => {
    const profiles = createMockProfiles(2)
    mockPrismaProfileFindMany.mockResolvedValueOnce(profiles)
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionRetrieve.mockRejectedValueOnce(
      new Error('Stripe retrieve failed')
    )

    await expect(withdrawChildren(FAMILY_ID, ['profile-1'])).rejects.toThrow(
      'Stripe billing update failed'
    )

    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: 'Stripe retrieve failed' }),
      expect.stringContaining('Stripe call failed'),
      expect.objectContaining({ familyReferenceId: FAMILY_ID })
    )

    expect(mockPrismaProfileUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'profile-1' },
        data: { status: 'ENROLLED' },
      })
    )

    expect(mockPrismaAssignmentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programProfileId: { in: ['profile-1'] },
          isActive: false,
        }),
        data: { isActive: true, endDate: null },
      })
    )
  })
})
