import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockFindFamilySubscription,
  mockFindLiveFamilySubscriptionIds,
  mockGetActiveBillingAssignmentsForProfiles,
  mockUpdateBillingAssignmentAmount,
  mockHandleBillingDivergence,
  mockStripeSubscriptionUpdate,
  mockStripeSubscriptionRetrieve,
  mockFindFamilyProfilesForWithdrawal,
  mockUpdateProgramProfileStatus,
  mockUpdateProgramProfileStatusMany,
  mockDeactivateBillingAssignments,
  mockReactivateBillingAssignments,
  mockUpdateSubscriptionAmount,
  mockDeactivateClassEnrollments,
  mockReactivateClassEnrollments,
  mockGetActiveEnrollmentsForProfiles,
  mockWithdrawEnrollmentsByIds,
  mockRestoreEnrollmentState,
  mockLogInfo,
  mockLogWarning,
  mockLogError,
} = vi.hoisted(() => ({
  mockFindFamilySubscription: vi.fn(),
  mockFindLiveFamilySubscriptionIds: vi.fn(),
  mockGetActiveBillingAssignmentsForProfiles: vi.fn(),
  mockUpdateBillingAssignmentAmount: vi.fn(),
  mockHandleBillingDivergence: vi.fn(),
  mockStripeSubscriptionUpdate: vi.fn(),
  mockStripeSubscriptionRetrieve: vi.fn(),
  mockFindFamilyProfilesForWithdrawal: vi.fn(),
  mockUpdateProgramProfileStatus: vi.fn(),
  mockUpdateProgramProfileStatusMany: vi.fn(),
  mockDeactivateBillingAssignments: vi.fn(),
  mockReactivateBillingAssignments: vi.fn(),
  mockUpdateSubscriptionAmount: vi.fn(),
  mockDeactivateClassEnrollments: vi.fn(),
  mockReactivateClassEnrollments: vi.fn(),
  mockGetActiveEnrollmentsForProfiles: vi.fn(),
  mockWithdrawEnrollmentsByIds: vi.fn(),
  mockRestoreEnrollmentState: vi.fn(),
  mockLogInfo: vi.fn(),
  mockLogWarning: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('../billing-helpers', () => ({
  findFamilySubscription: (...args: unknown[]) =>
    mockFindFamilySubscription(...args),
  findLiveFamilySubscriptionIds: (...args: unknown[]) =>
    mockFindLiveFamilySubscriptionIds(...args),
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
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn('tx-client'),
  },
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  findFamilyProfilesForWithdrawal: (...args: unknown[]) =>
    mockFindFamilyProfilesForWithdrawal(...args),
  updateProgramProfileStatus: (...args: unknown[]) =>
    mockUpdateProgramProfileStatus(...args),
  updateProgramProfileStatusMany: (...args: unknown[]) =>
    mockUpdateProgramProfileStatusMany(...args),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  deactivateBillingAssignmentsForProfiles: (...args: unknown[]) =>
    mockDeactivateBillingAssignments(...args),
  reactivateBillingAssignmentsForProfiles: (...args: unknown[]) =>
    mockReactivateBillingAssignments(...args),
  updateSubscriptionAmount: (...args: unknown[]) =>
    mockUpdateSubscriptionAmount(...args),
  getActiveBillingAssignmentsForProfiles: (...args: unknown[]) =>
    mockGetActiveBillingAssignmentsForProfiles(...args),
  updateBillingAssignmentAmount: (...args: unknown[]) =>
    mockUpdateBillingAssignmentAmount(...args),
  getBillingAccountByStripeCustomerId: vi.fn(),
  upsertBillingAccount: vi.fn(),
}))

vi.mock('@/lib/db/queries/dugsi-class', () => ({
  deactivateClassEnrollmentsForProfiles: (...args: unknown[]) =>
    mockDeactivateClassEnrollments(...args),
  reactivateClassEnrollmentsForProfiles: (...args: unknown[]) =>
    mockReactivateClassEnrollments(...args),
}))

vi.mock('@/lib/db/queries/enrollment', () => ({
  getActiveEnrollmentsForProfiles: (...args: unknown[]) =>
    mockGetActiveEnrollmentsForProfiles(...args),
  withdrawEnrollmentsByIds: (...args: unknown[]) =>
    mockWithdrawEnrollmentsByIds(...args),
  restoreEnrollmentState: (...args: unknown[]) =>
    mockRestoreEnrollmentState(...args),
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

vi.mock('@sentry/nextjs', () => ({
  startSpan: (_opts: unknown, fn: () => unknown) => fn(),
}))

import { ActionError } from '@/lib/errors/action-error'

import { withdrawChildren } from '../withdrawal-service'

beforeEach(() => {
  vi.clearAllMocks()
  mockFindLiveFamilySubscriptionIds.mockResolvedValue([])
  mockGetActiveBillingAssignmentsForProfiles.mockResolvedValue([])
  mockUpdateBillingAssignmentAmount.mockResolvedValue({})
  mockUpdateProgramProfileStatus.mockResolvedValue(undefined)
  mockUpdateProgramProfileStatusMany.mockImplementation((ids: string[]) =>
    Promise.resolve({ count: ids.length })
  )
  mockDeactivateBillingAssignments.mockResolvedValue({ count: 1 })
  mockReactivateBillingAssignments.mockResolvedValue({ count: 1 })
  mockUpdateSubscriptionAmount.mockResolvedValue({})
  mockDeactivateClassEnrollments.mockResolvedValue({ count: 1 })
  mockReactivateClassEnrollments.mockResolvedValue({ count: 1 })
  mockGetActiveEnrollmentsForProfiles.mockImplementation((ids: string[]) =>
    Promise.resolve(
      ids.map((id) => ({
        id: `enr-${id}`,
        status: 'ENROLLED',
        endDate: null,
        reason: null,
        programProfileId: id,
      }))
    )
  )
  mockWithdrawEnrollmentsByIds.mockResolvedValue({ count: 1 })
  mockRestoreEnrollmentState.mockResolvedValue({})
})

const FAMILY_ID = 'fam-uuid-123'

function createMockProfiles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `profile-${i + 1}`,
    familyReferenceId: FAMILY_ID,
    program: 'DUGSI_PROGRAM',
    status: 'ENROLLED',
    person: { name: `Child ${i + 1}` },
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
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce([])

    await expect(withdrawChildren(FAMILY_ID, ['profile-1'])).rejects.toThrow(
      ActionError
    )
  })

  it('should throw when profileIds do not belong to family', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )

    await expect(
      withdrawChildren(FAMILY_ID, ['profile-1', 'nonexistent'])
    ).rejects.toThrow(/not found or not eligible/)
  })

  it('should withdraw single child and update Stripe rate with metadata', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
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

    expect(mockUpdateProgramProfileStatusMany).toHaveBeenCalledWith(
      ['profile-1'],
      'WITHDRAWN',
      ['REGISTERED', 'ENROLLED'],
      'tx-client'
    )
    expect(mockDeactivateBillingAssignments).toHaveBeenCalledWith(
      ['profile-1'],
      expect.any(Date),
      'tx-client'
    )
    expect(mockDeactivateClassEnrollments).toHaveBeenCalledWith(
      ['profile-1'],
      expect.any(Date),
      'tx-client'
    )
    expect(mockWithdrawEnrollmentsByIds).toHaveBeenCalledWith(
      ['enr-profile-1'],
      'Withdrawn by admin',
      expect.any(Date),
      'tx-client'
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
        metadata: expect.objectContaining({
          childCount: '1',
          calculatedRate: '8000',
          profileIds: 'profile-2',
          Children: 'Child 2',
        }),
      })
    )
  })

  it('should withdraw multiple children in bulk', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(3)
    )
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
    expect(mockWithdrawEnrollmentsByIds).toHaveBeenCalledWith(
      ['enr-profile-1', 'enr-profile-2'],
      'Withdrawn by admin',
      expect.any(Date),
      'tx-client'
    )
  })

  it('should cancel subscription when all children withdrawn', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})

    const result = await withdrawChildren(FAMILY_ID, ['profile-1', 'profile-2'])

    expect(result.success).toBe(true)
    expect(result.subscriptionCanceled).toBe(true)
    expect(result.remainingCount).toBe(0)

    expect(mockStripeSubscriptionUpdate).toHaveBeenCalledWith(
      'sub_stripe123',
      expect.objectContaining({
        cancel_at_period_end: true,
        metadata: expect.objectContaining({
          childCount: '0',
          profileIds: '',
        }),
      })
    )
  })

  it('should skip enrollment update when no active enrollment exists', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(1)
    )
    mockGetActiveEnrollmentsForProfiles.mockResolvedValueOnce([])
    mockFindFamilySubscription.mockResolvedValueOnce(null)

    const result = await withdrawChildren(FAMILY_ID, ['profile-1'])

    expect(result.success).toBe(true)
    expect(mockWithdrawEnrollmentsByIds).not.toHaveBeenCalled()
    expect(mockDeactivateClassEnrollments).toHaveBeenCalled()
  })

  it('should skip enrollment update when transition is invalid (COMPLETED)', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(1)
    )
    mockGetActiveEnrollmentsForProfiles.mockResolvedValueOnce([
      {
        id: 'enr-profile-1',
        status: 'COMPLETED',
        endDate: null,
        reason: null,
        programProfileId: 'profile-1',
      },
    ])
    mockFindFamilySubscription.mockResolvedValueOnce(null)

    const result = await withdrawChildren(FAMILY_ID, ['profile-1'])

    expect(result.success).toBe(true)
    expect(mockWithdrawEnrollmentsByIds).not.toHaveBeenCalled()
  })

  it('should update Stripe price when subscription is paused so resume bills correctly', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
    mockFindFamilySubscription.mockResolvedValueOnce({
      ...MOCK_SUBSCRIPTION,
      status: 'paused',
    })
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ id: 'si_item1' }] },
    })
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})

    const result = await withdrawChildren(FAMILY_ID, ['profile-1'])

    expect(result.success).toBe(true)
    expect(result.remainingCount).toBe(1)
    expect(mockStripeSubscriptionUpdate).toHaveBeenCalledWith(
      'sub_stripe123',
      expect.objectContaining({
        items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 8000 }),
          }),
        ],
      })
    )
    expect(mockUpdateSubscriptionAmount).toHaveBeenCalledWith('db-sub-id', 8000)
  })

  it('should set cancel_at_period_end when all children withdrawn from paused subscription', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
    mockFindFamilySubscription.mockResolvedValueOnce({
      ...MOCK_SUBSCRIPTION,
      status: 'paused',
    })
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})

    const result = await withdrawChildren(FAMILY_ID, ['profile-1', 'profile-2'])

    expect(result.success).toBe(true)
    expect(result.subscriptionCanceled).toBe(true)
    expect(mockStripeSubscriptionUpdate).toHaveBeenCalledWith(
      'sub_stripe123',
      expect.objectContaining({ cancel_at_period_end: true })
    )
    expect(mockUpdateSubscriptionAmount).toHaveBeenCalledWith('db-sub-id', 0)
  })

  it('should dedupe repeated profileIds instead of failing with an empty missing list', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
    mockFindFamilySubscription.mockResolvedValueOnce(null)

    const result = await withdrawChildren(FAMILY_ID, ['profile-1', 'profile-1'])

    expect(result.success).toBe(true)
    expect(result.withdrawnCount).toBe(1)
    expect(mockUpdateProgramProfileStatusMany).toHaveBeenCalledWith(
      ['profile-1'],
      'WITHDRAWN',
      ['REGISTERED', 'ENROLLED'],
      'tx-client'
    )
  })

  it('should refuse withdrawal when family has multiple live subscriptions', async () => {
    mockFindLiveFamilySubscriptionIds.mockResolvedValueOnce(['sub-a', 'sub-b'])

    await expect(withdrawChildren(FAMILY_ID, ['profile-1'])).rejects.toThrow(
      /multiple active subscriptions/
    )

    expect(mockUpdateProgramProfileStatusMany).not.toHaveBeenCalled()
    expect(mockStripeSubscriptionUpdate).not.toHaveBeenCalled()
  })

  it('should map serialization conflicts to a retryable error', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
    mockUpdateProgramProfileStatusMany.mockRejectedValueOnce(
      Object.assign(new Error('write conflict'), { code: 'P2034' })
    )

    await expect(withdrawChildren(FAMILY_ID, ['profile-1'])).rejects.toThrow(
      /in progress/
    )

    expect(mockStripeSubscriptionUpdate).not.toHaveBeenCalled()
  })

  it('should re-split the new rate across surviving assignments', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(3)
    )
    mockFindFamilySubscription.mockResolvedValueOnce({
      ...MOCK_SUBSCRIPTION,
      amount: 23000,
    })
    mockGetActiveBillingAssignmentsForProfiles.mockResolvedValueOnce([
      { id: 'ba-2', amount: 7667 },
      { id: 'ba-3', amount: 7666 },
    ])
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ id: 'si_item1' }] },
    })
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})

    const result = await withdrawChildren(FAMILY_ID, ['profile-1'])

    expect(result.success).toBe(true)
    expect(mockGetActiveBillingAssignmentsForProfiles).toHaveBeenCalledWith(
      ['profile-2', 'profile-3'],
      'db-sub-id',
      'tx-client'
    )
    expect(mockUpdateBillingAssignmentAmount).toHaveBeenCalledWith(
      'ba-2',
      8000,
      'tx-client'
    )
    expect(mockUpdateBillingAssignmentAmount).toHaveBeenCalledWith(
      'ba-3',
      8000,
      'tx-client'
    )
  })

  it('should restore original assignment amounts when Stripe fails after re-split', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(3)
    )
    mockFindFamilySubscription.mockResolvedValueOnce({
      ...MOCK_SUBSCRIPTION,
      amount: 23000,
    })
    mockGetActiveBillingAssignmentsForProfiles.mockResolvedValueOnce([
      { id: 'ba-2', amount: 7667 },
      { id: 'ba-3', amount: 7666 },
    ])
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ id: 'si_item1' }] },
    })
    mockStripeSubscriptionUpdate.mockRejectedValueOnce(new Error('Stripe down'))

    await expect(withdrawChildren(FAMILY_ID, ['profile-1'])).rejects.toThrow(
      'Stripe billing update failed'
    )

    expect(mockUpdateBillingAssignmentAmount).toHaveBeenCalledWith(
      'ba-2',
      7667,
      'tx-client'
    )
    expect(mockUpdateBillingAssignmentAmount).toHaveBeenCalledWith(
      'ba-3',
      7666,
      'tx-client'
    )
  })

  it('should abort withdrawal when profiles changed status concurrently', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
    mockUpdateProgramProfileStatusMany.mockResolvedValueOnce({ count: 1 })

    await expect(
      withdrawChildren(FAMILY_ID, ['profile-1', 'profile-2'])
    ).rejects.toThrow(/changed status during withdrawal/)

    expect(mockStripeSubscriptionUpdate).not.toHaveBeenCalled()
    expect(mockDeactivateBillingAssignments).not.toHaveBeenCalled()
  })

  it('should warn when admin override is reset', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
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
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ id: 'si_item1' }] },
    })
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})
    mockUpdateSubscriptionAmount.mockRejectedValueOnce(
      new Error('DB connection lost')
    )
    mockHandleBillingDivergence.mockResolvedValueOnce(
      'Stripe updated to 8000 cents but DB update failed: DB connection lost'
    )

    const result = await withdrawChildren(FAMILY_ID, ['profile-1'])

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB update failed')
    expect(mockHandleBillingDivergence).toHaveBeenCalled()
    expect(mockReactivateBillingAssignments).not.toHaveBeenCalled()
    expect(mockUpdateProgramProfileStatus).not.toHaveBeenCalled()
  })

  it('should treat post-cancel DB failure as divergence, not rollback', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockResolvedValueOnce({})
    mockUpdateSubscriptionAmount.mockRejectedValueOnce(
      new Error('DB connection lost')
    )
    mockHandleBillingDivergence.mockResolvedValueOnce(
      'Stripe cancel_at_period_end set but DB update failed. Check logs for details.'
    )

    const result = await withdrawChildren(FAMILY_ID, ['profile-1', 'profile-2'])

    expect(result.success).toBe(false)
    expect(result.subscriptionCanceled).toBe(true)
    expect(mockReactivateBillingAssignments).not.toHaveBeenCalled()
    expect(mockUpdateProgramProfileStatus).not.toHaveBeenCalled()
  })

  it('should work without a subscription (no billing)', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(1)
    )
    mockFindFamilySubscription.mockResolvedValueOnce(null)

    const result = await withdrawChildren(FAMILY_ID, ['profile-1'])

    expect(result.success).toBe(true)
    expect(result.withdrawnCount).toBe(1)
    expect(mockStripeSubscriptionUpdate).not.toHaveBeenCalled()
  })

  it('should rollback DB when Stripe rate update fails', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
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

    expect(mockUpdateProgramProfileStatus).toHaveBeenCalledWith(
      'profile-1',
      'ENROLLED',
      'tx-client'
    )
    expect(mockReactivateBillingAssignments).toHaveBeenCalledWith(
      ['profile-1'],
      expect.any(Date),
      'tx-client'
    )
    expect(mockRestoreEnrollmentState).toHaveBeenCalledWith(
      'enr-profile-1',
      expect.objectContaining({
        status: 'ENROLLED',
        endDate: null,
        reason: null,
      }),
      'tx-client'
    )
    expect(mockReactivateClassEnrollments).toHaveBeenCalledWith(
      ['profile-1'],
      expect.any(Date),
      'tx-client'
    )
  })

  it('should not rollback on Stripe connection failure (unknown outcome)', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ id: 'si_item1' }] },
    })
    const connectionError = Object.assign(new Error('Request timed out'), {
      type: 'StripeConnectionError',
    })
    mockStripeSubscriptionUpdate.mockRejectedValueOnce(connectionError)

    await expect(withdrawChildren(FAMILY_ID, ['profile-1'])).rejects.toThrow(
      /may not have completed/
    )

    expect(mockUpdateProgramProfileStatus).not.toHaveBeenCalled()
    expect(mockReactivateBillingAssignments).not.toHaveBeenCalled()
    expect(mockRestoreEnrollmentState).not.toHaveBeenCalled()
    expect(mockReactivateClassEnrollments).not.toHaveBeenCalled()
  })

  it('should rollback DB when Stripe cancel_at_period_end fails', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionUpdate.mockRejectedValueOnce(
      new Error('Stripe cancel failed')
    )

    await expect(
      withdrawChildren(FAMILY_ID, ['profile-1', 'profile-2'])
    ).rejects.toThrow('Stripe billing update failed')

    expect(mockUpdateProgramProfileStatus).toHaveBeenCalledWith(
      'profile-1',
      'ENROLLED',
      'tx-client'
    )
    expect(mockUpdateProgramProfileStatus).toHaveBeenCalledWith(
      'profile-2',
      'ENROLLED',
      'tx-client'
    )
    expect(mockRestoreEnrollmentState).toHaveBeenCalledTimes(2)
    expect(mockReactivateBillingAssignments).toHaveBeenCalledWith(
      ['profile-1', 'profile-2'],
      expect.any(Date),
      'tx-client'
    )
  })

  it('should rollback DB when Stripe retrieve fails', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
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
    expect(mockReactivateBillingAssignments).toHaveBeenCalled()
    expect(mockReactivateClassEnrollments).toHaveBeenCalled()
  })

  it('should log but not throw when rollback itself fails', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(
      createMockProfiles(2)
    )
    mockFindFamilySubscription.mockResolvedValueOnce(MOCK_SUBSCRIPTION)
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ id: 'si_item1' }] },
    })
    mockStripeSubscriptionUpdate.mockRejectedValueOnce(new Error('Stripe down'))
    mockUpdateProgramProfileStatus.mockRejectedValueOnce(
      new Error('DB down too')
    )

    await expect(withdrawChildren(FAMILY_ID, ['profile-1'])).rejects.toThrow(
      /rollback also failed/
    )

    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: 'DB down too' }),
      expect.stringContaining('MANUAL INTERVENTION REQUIRED'),
      expect.objectContaining({ familyReferenceId: FAMILY_ID })
    )
  })
})
