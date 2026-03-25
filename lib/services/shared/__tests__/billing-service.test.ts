import { StripeAccountType } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

import { STRIPE_SUBSCRIPTION_STATUS } from '@/lib/constants/stripe'

const {
  mockGetBillingAccountByCustomerId,
  mockUpsertBillingAccount,
  mockBillingAssignmentFindMany,
  mockBillingAssignmentCreateMany,
  mockBillingAssignmentUpdateMany,
  mockPersonFindFirst,
  mockTransaction,
  mockSentryStartSpan,
} = vi.hoisted(() => ({
  mockGetBillingAccountByCustomerId: vi.fn(),
  mockUpsertBillingAccount: vi.fn(),
  mockBillingAssignmentFindMany: vi.fn(),
  mockBillingAssignmentCreateMany: vi.fn(),
  mockBillingAssignmentUpdateMany: vi.fn(),
  mockPersonFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockSentryStartSpan: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    billingAssignment: {
      findMany: (...args: unknown[]) => mockBillingAssignmentFindMany(...args),
      createMany: (...args: unknown[]) =>
        mockBillingAssignmentCreateMany(...args),
      updateMany: (...args: unknown[]) =>
        mockBillingAssignmentUpdateMany(...args),
    },
    person: {
      findFirst: (...args: unknown[]) => mockPersonFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getBillingAccountByStripeCustomerId: (...args: unknown[]) =>
    mockGetBillingAccountByCustomerId(...args),
  upsertBillingAccount: (...args: unknown[]) =>
    mockUpsertBillingAccount(...args),
}))

vi.mock('@sentry/nextjs', () => ({
  startSpan: (...args: unknown[]) => mockSentryStartSpan(...args),
}))

import {
  calculateSplitAmounts,
  createOrUpdateBillingAccount,
  getBillingAccountByCustomerId,
  getBillingStatusByEmail,
  getBillingStatusForProfiles,
  linkSubscriptionToProfiles,
  unlinkSubscription,
} from '../billing-service'

// ─── calculateSplitAmounts (pure function) ───────────────────────────

describe('calculateSplitAmounts', () => {
  it('should return full amount for single split', () => {
    expect(calculateSplitAmounts(500, 1)).toEqual([500])
  })

  it('should split evenly when divisible', () => {
    expect(calculateSplitAmounts(600, 3)).toEqual([200, 200, 200])
  })

  it('should assign remainder to last item', () => {
    expect(calculateSplitAmounts(500, 3)).toEqual([166, 166, 168])
  })

  it('should handle two-way split with remainder', () => {
    expect(calculateSplitAmounts(501, 2)).toEqual([250, 251])
  })

  it('should sum to exact total amount', () => {
    const total = 1999
    const count = 7
    const amounts = calculateSplitAmounts(total, count)
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(total)
    expect(amounts).toHaveLength(count)
  })

  it('should handle zero total amount', () => {
    expect(calculateSplitAmounts(0, 3)).toEqual([0, 0, 0])
  })

  it('should throw for negative total amount', () => {
    expect(() => calculateSplitAmounts(-100, 2)).toThrow(
      'Total amount must be non-negative'
    )
  })

  it('should throw for zero count', () => {
    expect(() => calculateSplitAmounts(500, 0)).toThrow(
      'Count must be positive'
    )
  })

  it('should throw for negative count', () => {
    expect(() => calculateSplitAmounts(500, -1)).toThrow(
      'Count must be positive'
    )
  })

  it('should handle large amount with many splits', () => {
    const amounts = calculateSplitAmounts(10000, 100)
    expect(amounts).toHaveLength(100)
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(10000)
    expect(amounts.every((a) => a === 100)).toBe(true)
  })

  // Zero-valued splits are valid at this utility level. The caller
  // (linkSubscriptionToProfiles) has a hasInvalidAmount guard that
  // rejects these before creating billing assignments.
  it('should handle amount smaller than count', () => {
    const amounts = calculateSplitAmounts(2, 5)
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(2)
    expect(amounts).toEqual([0, 0, 0, 0, 2])
  })
})

// ─── getBillingAccountByCustomerId ───────────────────────────────────

describe('getBillingAccountByCustomerId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delegate to the query function', async () => {
    const mockAccount = { id: 'ba-1', stripeCustomerIdMahad: 'cus_123' }
    mockGetBillingAccountByCustomerId.mockResolvedValue(mockAccount)

    const result = await getBillingAccountByCustomerId(
      'cus_123',
      StripeAccountType.MAHAD
    )

    expect(mockGetBillingAccountByCustomerId).toHaveBeenCalledWith(
      'cus_123',
      StripeAccountType.MAHAD
    )
    expect(result).toBe(mockAccount)
  })

  it('should return null when account not found', async () => {
    mockGetBillingAccountByCustomerId.mockResolvedValue(null)

    const result = await getBillingAccountByCustomerId(
      'cus_unknown',
      StripeAccountType.DUGSI
    )

    expect(result).toBeNull()
  })
})

// ─── createOrUpdateBillingAccount ────────────────────────────────────

describe('createOrUpdateBillingAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should map MAHAD customer ID to stripeCustomerIdMahad', async () => {
    mockUpsertBillingAccount.mockResolvedValue({ id: 'ba-1' })

    await createOrUpdateBillingAccount({
      personId: 'person-1',
      accountType: StripeAccountType.MAHAD,
      stripeCustomerId: 'cus_mahad',
    })

    expect(mockUpsertBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: 'person-1',
        accountType: StripeAccountType.MAHAD,
        stripeCustomerIdMahad: 'cus_mahad',
      })
    )
  })

  it('should map DUGSI customer ID and payment intent', async () => {
    mockUpsertBillingAccount.mockResolvedValue({ id: 'ba-2' })

    await createOrUpdateBillingAccount({
      personId: 'person-1',
      accountType: StripeAccountType.DUGSI,
      stripeCustomerId: 'cus_dugsi',
      paymentIntentId: 'pi_123',
    })

    expect(mockUpsertBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerIdDugsi: 'cus_dugsi',
        paymentIntentIdDugsi: 'pi_123',
      })
    )
  })

  it('should map YOUTH_EVENTS customer ID to stripeCustomerIdYouth', async () => {
    mockUpsertBillingAccount.mockResolvedValue({ id: 'ba-3' })

    await createOrUpdateBillingAccount({
      personId: 'person-1',
      accountType: StripeAccountType.YOUTH_EVENTS,
      stripeCustomerId: 'cus_youth',
    })

    expect(mockUpsertBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerIdYouth: 'cus_youth',
      })
    )
  })

  it('should map GENERAL_DONATION customer ID to stripeCustomerIdDonation', async () => {
    mockUpsertBillingAccount.mockResolvedValue({ id: 'ba-4' })

    await createOrUpdateBillingAccount({
      personId: 'person-1',
      accountType: StripeAccountType.GENERAL_DONATION,
      stripeCustomerId: 'cus_donation',
    })

    expect(mockUpsertBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerIdDonation: 'cus_donation',
      })
    )
  })

  it('should include payment method capture info', async () => {
    const capturedAt = new Date('2026-01-15')
    mockUpsertBillingAccount.mockResolvedValue({ id: 'ba-5' })

    await createOrUpdateBillingAccount({
      personId: 'person-1',
      accountType: StripeAccountType.MAHAD,
      paymentMethodCaptured: true,
      paymentMethodCapturedAt: capturedAt,
    })

    expect(mockUpsertBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethodCaptured: true,
        paymentMethodCapturedAt: capturedAt,
      })
    )
  })

  it('should not set customer ID fields when stripeCustomerId is absent', async () => {
    mockUpsertBillingAccount.mockResolvedValue({ id: 'ba-6' })

    await createOrUpdateBillingAccount({
      personId: 'person-1',
      accountType: StripeAccountType.MAHAD,
    })

    const callArg = mockUpsertBillingAccount.mock.calls[0][0]
    expect(callArg.stripeCustomerIdMahad).toBeUndefined()
  })

  it('should handle null personId', async () => {
    mockUpsertBillingAccount.mockResolvedValue({ id: 'ba-7' })

    await createOrUpdateBillingAccount({
      personId: null,
      accountType: StripeAccountType.MAHAD,
      stripeCustomerId: 'cus_orphan',
    })

    expect(mockUpsertBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: null,
      })
    )
  })
})

// ─── linkSubscriptionToProfiles ──────────────────────────────────────

describe('linkSubscriptionToProfiles', () => {
  const validUuid1 = '00000000-0000-4000-a000-000000000001'
  const validUuid2 = '00000000-0000-4000-a000-000000000002'
  const validUuid3 = '00000000-0000-4000-a000-000000000003'

  beforeEach(() => {
    vi.clearAllMocks()

    mockSentryStartSpan.mockImplementation(
      (_opts: unknown, fn: () => unknown) => fn()
    )

    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const tx = {
          billingAssignment: {
            findMany: mockBillingAssignmentFindMany,
            createMany: mockBillingAssignmentCreateMany,
          },
        }
        return callback(tx)
      }
    )
  })

  it('should use createMany with skipDuplicates for batch insert', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])
    mockBillingAssignmentCreateMany.mockResolvedValue({ count: 2 })

    const count = await linkSubscriptionToProfiles(
      'sub_123',
      [validUuid1, validUuid2],
      1000
    )

    expect(count).toBe(2)
    expect(mockBillingAssignmentCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          subscriptionId: 'sub_123',
          programProfileId: validUuid1,
          amount: 500,
          isActive: true,
        }),
        expect.objectContaining({
          subscriptionId: 'sub_123',
          programProfileId: validUuid2,
          amount: 500,
          isActive: true,
        }),
      ]),
      skipDuplicates: true,
    })
  })

  it('should split amounts evenly across profiles', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])
    mockBillingAssignmentCreateMany.mockResolvedValue({ count: 2 })

    await linkSubscriptionToProfiles('sub_123', [validUuid1, validUuid2], 1000)

    const createManyCall = mockBillingAssignmentCreateMany.mock.calls[0][0]
    expect(createManyCall.data[0].amount).toBe(500)
    expect(createManyCall.data[1].amount).toBe(500)
  })

  it('should assign remainder to last profile', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])
    mockBillingAssignmentCreateMany.mockResolvedValue({ count: 3 })

    await linkSubscriptionToProfiles(
      'sub_123',
      [validUuid1, validUuid2, validUuid3],
      1000
    )

    const createManyCall = mockBillingAssignmentCreateMany.mock.calls[0][0]
    expect(createManyCall.data[0].amount).toBe(333)
    expect(createManyCall.data[1].amount).toBe(333)
    expect(createManyCall.data[2].amount).toBe(334)
  })

  it('should calculate percentage for multi-profile subscriptions', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])
    mockBillingAssignmentCreateMany.mockResolvedValue({ count: 2 })

    await linkSubscriptionToProfiles('sub_123', [validUuid1, validUuid2], 1000)

    const createManyCall = mockBillingAssignmentCreateMany.mock.calls[0][0]
    expect(createManyCall.data[0].percentage).toBe(50)
    expect(createManyCall.data[1].percentage).toBe(50)
  })

  it('should calculate float percentages for uneven splits', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])
    mockBillingAssignmentCreateMany.mockResolvedValue({ count: 3 })

    await linkSubscriptionToProfiles(
      'sub_123',
      [validUuid1, validUuid2, validUuid3],
      1000
    )

    const createManyCall = mockBillingAssignmentCreateMany.mock.calls[0][0]
    expect(createManyCall.data[0].percentage).toBeCloseTo(33.3, 1)
    expect(createManyCall.data[1].percentage).toBeCloseTo(33.3, 1)
    expect(createManyCall.data[2].percentage).toBeCloseTo(33.4, 1)
  })

  it('should set percentage to null for single profile', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])
    mockBillingAssignmentCreateMany.mockResolvedValue({ count: 1 })

    await linkSubscriptionToProfiles('sub_123', [validUuid1], 500)

    const createManyCall = mockBillingAssignmentCreateMany.mock.calls[0][0]
    expect(createManyCall.data[0].percentage).toBeNull()
  })

  it('should skip profiles that already have active assignments', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([
      { programProfileId: validUuid1 },
    ])
    mockBillingAssignmentCreateMany.mockResolvedValue({ count: 1 })

    const count = await linkSubscriptionToProfiles(
      'sub_123',
      [validUuid1, validUuid2],
      1000
    )

    expect(count).toBe(1)
    expect(mockBillingAssignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subscriptionId: 'sub_123',
        }),
      })
    )
    expect(mockBillingAssignmentCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          programProfileId: validUuid2,
          amount: 500,
        }),
      ],
      skipDuplicates: true,
    })
  })

  it('should return 0 when all profiles already have assignments', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([
      { programProfileId: validUuid1 },
      { programProfileId: validUuid2 },
    ])

    const count = await linkSubscriptionToProfiles(
      'sub_123',
      [validUuid1, validUuid2],
      1000
    )

    expect(count).toBe(0)
    expect(mockBillingAssignmentCreateMany).not.toHaveBeenCalled()
  })

  it('should include notes in assignments', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])
    mockBillingAssignmentCreateMany.mockResolvedValue({ count: 1 })

    await linkSubscriptionToProfiles(
      'sub_123',
      [validUuid1],
      500,
      'Family billing'
    )

    const createManyCall = mockBillingAssignmentCreateMany.mock.calls[0][0]
    expect(createManyCall.data[0].notes).toBe('Family billing')
  })

  it('should use existing client when provided (transaction path)', async () => {
    const txClient = {
      billingAssignment: {
        findMany: mockBillingAssignmentFindMany,
        createMany: mockBillingAssignmentCreateMany,
      },
    }
    mockBillingAssignmentFindMany.mockResolvedValue([])
    mockBillingAssignmentCreateMany.mockResolvedValue({ count: 1 })

    await linkSubscriptionToProfiles(
      'sub_123',
      [validUuid1],
      500,
      undefined,
      txClient as never
    )

    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockSentryStartSpan).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'db' }),
      expect.any(Function)
    )
  })

  it('should wrap in transaction when using default client', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])
    mockBillingAssignmentCreateMany.mockResolvedValue({ count: 1 })

    await linkSubscriptionToProfiles('sub_123', [validUuid1], 500)

    expect(mockSentryStartSpan).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'db.transaction' }),
      expect.any(Function)
    )
    expect(mockTransaction).toHaveBeenCalled()
  })

  // Zod validation tests
  it('should reject empty subscriptionId', async () => {
    await expect(
      linkSubscriptionToProfiles('', [validUuid1], 500)
    ).rejects.toThrow()
  })

  it('should reject empty profileIds array', async () => {
    await expect(
      linkSubscriptionToProfiles('sub_123', [], 500)
    ).rejects.toThrow()
  })

  it('should reject non-UUID profileIds', async () => {
    await expect(
      linkSubscriptionToProfiles('sub_123', ['not-a-uuid'], 500)
    ).rejects.toThrow()
  })

  it('should reject zero total amount', async () => {
    await expect(
      linkSubscriptionToProfiles('sub_123', [validUuid1], 0)
    ).rejects.toThrow()
  })

  it('should reject negative total amount', async () => {
    await expect(
      linkSubscriptionToProfiles('sub_123', [validUuid1], -100)
    ).rejects.toThrow()
  })

  it('should reject non-integer total amount', async () => {
    await expect(
      linkSubscriptionToProfiles('sub_123', [validUuid1], 49.99)
    ).rejects.toThrow()
  })

  it('should reject when split would create zero-amount assignments', async () => {
    await expect(
      linkSubscriptionToProfiles(
        'sub_123',
        [validUuid1, validUuid2, validUuid3],
        2
      )
    ).rejects.toThrow('zero-amount assignments')
  })
})

// ─── unlinkSubscription ──────────────────────────────────────────────

describe('unlinkSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should deactivate all active assignments for the subscription', async () => {
    mockBillingAssignmentUpdateMany.mockResolvedValue({ count: 3 })

    const count = await unlinkSubscription('sub_123')

    expect(count).toBe(3)
    expect(mockBillingAssignmentUpdateMany).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub_123', isActive: true },
      data: { isActive: false, endDate: expect.any(Date) },
    })
  })

  it('should return 0 when no active assignments exist', async () => {
    mockBillingAssignmentUpdateMany.mockResolvedValue({ count: 0 })

    const count = await unlinkSubscription('sub_nonexistent')

    expect(count).toBe(0)
  })

  it('should use provided client for transaction support', async () => {
    const mockUpdateMany = vi.fn().mockResolvedValue({ count: 2 })
    const txClient = {
      billingAssignment: { updateMany: mockUpdateMany },
    }

    const count = await unlinkSubscription('sub_123', txClient as never)

    expect(count).toBe(2)
    expect(mockUpdateMany).toHaveBeenCalled()
    expect(mockBillingAssignmentUpdateMany).not.toHaveBeenCalled()
  })
})

// ─── getBillingStatusByEmail ─────────────────────────────────────────

describe('getBillingStatusByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw when person not found', async () => {
    mockPersonFindFirst.mockResolvedValue(null)

    await expect(
      getBillingStatusByEmail('nobody@test.com', StripeAccountType.MAHAD)
    ).rejects.toThrow('Person not found with this email address')
  })

  it('should return status for person with active MAHAD subscription', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      billingAccounts: [
        {
          stripeCustomerIdMahad: 'cus_mahad_123',
          paymentMethodCaptured: true,
          subscriptions: [
            {
              status: 'active',
              paidUntil: new Date('2026-04-01'),
              currentPeriodStart: new Date('2026-03-01'),
              currentPeriodEnd: new Date('2026-04-01'),
            },
          ],
        },
      ],
    })

    const result = await getBillingStatusByEmail(
      'test@example.com',
      StripeAccountType.MAHAD
    )

    expect(result).toEqual({
      hasPaymentMethod: true,
      hasActiveSubscription: true,
      stripeCustomerId: 'cus_mahad_123',
      subscriptionStatus: 'active',
      paidUntil: new Date('2026-04-01'),
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: new Date('2026-04-01'),
    })
  })

  it('should return DUGSI customer ID for DUGSI account type', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      billingAccounts: [
        {
          stripeCustomerIdDugsi: 'cus_dugsi_456',
          paymentMethodCaptured: false,
          subscriptions: [],
        },
      ],
    })

    const result = await getBillingStatusByEmail(
      'test@example.com',
      StripeAccountType.DUGSI
    )

    expect(result).toEqual(
      expect.objectContaining({
        stripeCustomerId: 'cus_dugsi_456',
        hasPaymentMethod: false,
        hasActiveSubscription: false,
      })
    )
  })

  it('should return YOUTH_EVENTS customer ID', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      billingAccounts: [
        {
          stripeCustomerIdYouth: 'cus_youth_789',
          paymentMethodCaptured: false,
          subscriptions: [],
        },
      ],
    })

    const result = await getBillingStatusByEmail(
      'test@example.com',
      StripeAccountType.YOUTH_EVENTS
    )

    expect(result).toEqual(
      expect.objectContaining({
        stripeCustomerId: 'cus_youth_789',
        hasPaymentMethod: false,
        hasActiveSubscription: false,
      })
    )
  })

  it('should return GENERAL_DONATION customer ID', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      billingAccounts: [
        {
          stripeCustomerIdDonation: 'cus_don_abc',
          paymentMethodCaptured: false,
          subscriptions: [],
        },
      ],
    })

    const result = await getBillingStatusByEmail(
      'test@example.com',
      StripeAccountType.GENERAL_DONATION
    )

    expect(result).toEqual(
      expect.objectContaining({
        stripeCustomerId: 'cus_don_abc',
        hasPaymentMethod: false,
        hasActiveSubscription: false,
      })
    )
  })

  it('should exclude non-active subscriptions from status', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      billingAccounts: [
        {
          stripeCustomerIdMahad: 'cus_mahad_123',
          paymentMethodCaptured: true,
          subscriptions: [],
        },
      ],
    })

    const result = await getBillingStatusByEmail(
      'test@example.com',
      StripeAccountType.MAHAD
    )

    expect(result.hasActiveSubscription).toBe(false)
    expect(result.subscriptionStatus).toBeNull()
    expect(mockPersonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          billingAccounts: expect.objectContaining({
            include: expect.objectContaining({
              subscriptions: expect.objectContaining({
                where: {
                  status: {
                    in: [
                      STRIPE_SUBSCRIPTION_STATUS.ACTIVE,
                      STRIPE_SUBSCRIPTION_STATUS.TRIALING,
                    ],
                  },
                },
              }),
            }),
          }),
        }),
      })
    )
  })

  it('should return defaults when no billing account exists', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      billingAccounts: [],
    })

    const result = await getBillingStatusByEmail(
      'test@example.com',
      StripeAccountType.MAHAD
    )

    expect(result).toEqual({
      hasPaymentMethod: false,
      hasActiveSubscription: false,
      stripeCustomerId: null,
      subscriptionStatus: null,
      paidUntil: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    })
  })

  it('should normalize email to lowercase and trim', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      billingAccounts: [],
    })

    await getBillingStatusByEmail(
      '  Test@Example.COM  ',
      StripeAccountType.MAHAD
    )

    expect(mockPersonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contactPoints: {
            some: {
              type: 'EMAIL',
              value: 'test@example.com',
            },
          },
        },
      })
    )
  })
})

// ─── getBillingStatusForProfiles ─────────────────────────────────────

describe('getBillingStatusForProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return status map for all profiles', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([
      { programProfileId: 'profile-1', amount: 250 },
      { programProfileId: 'profile-3', amount: 500 },
    ])

    const result = await getBillingStatusForProfiles([
      'profile-1',
      'profile-2',
      'profile-3',
    ])

    expect(result.get('profile-1')).toEqual({
      hasSubscription: true,
      amount: 250,
    })
    expect(result.get('profile-2')).toEqual({
      hasSubscription: false,
      amount: null,
    })
    expect(result.get('profile-3')).toEqual({
      hasSubscription: true,
      amount: 500,
    })
  })

  it('should return all profiles as unsubscribed when none have assignments', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])

    const result = await getBillingStatusForProfiles([
      'profile-1',
      'profile-2',
      'profile-3',
    ])

    expect(result.size).toBe(3)
    for (const [, status] of result) {
      expect(status).toEqual({ hasSubscription: false, amount: null })
    }
  })

  it('should return empty map for empty input', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])

    const result = await getBillingStatusForProfiles([])

    expect(result.size).toBe(0)
  })

  it('should query only active assignments', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])

    await getBillingStatusForProfiles(['profile-1'])

    expect(mockBillingAssignmentFindMany).toHaveBeenCalledWith({
      where: {
        programProfileId: { in: ['profile-1'] },
        isActive: true,
      },
      select: {
        programProfileId: true,
        amount: true,
      },
    })
  })

  it('should batch fetch in a single query (no N+1)', async () => {
    mockBillingAssignmentFindMany.mockResolvedValue([])

    await getBillingStatusForProfiles(['p-1', 'p-2', 'p-3', 'p-4', 'p-5'])

    expect(mockBillingAssignmentFindMany).toHaveBeenCalledTimes(1)
  })
})
