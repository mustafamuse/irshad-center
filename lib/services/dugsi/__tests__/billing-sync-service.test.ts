import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'

import { syncFamilyBillingRate } from '../billing-sync-service'

const {
  mockFindFamilySubscription,
  mockFindLiveFamilySubscriptionIds,
  mockFindFamilyLiveSubscriptions,
  mockHandleBillingDivergence,
  mockFindFamilyProfilesForWithdrawal,
  mockGetActiveAssignmentsForSubscription,
  mockCreateBillingAssignment,
  mockUpdateBillingAssignmentAmount,
  mockUpdateSubscriptionAmount,
  mockDeactivateBillingAssignmentsForProfiles,
  mockUpdatePricing,
} = vi.hoisted(() => ({
  mockFindFamilySubscription: vi.fn(),
  mockFindLiveFamilySubscriptionIds: vi.fn(),
  mockFindFamilyLiveSubscriptions: vi.fn(),
  mockHandleBillingDivergence: vi.fn(),
  mockFindFamilyProfilesForWithdrawal: vi.fn(),
  mockGetActiveAssignmentsForSubscription: vi.fn(),
  mockCreateBillingAssignment: vi.fn(),
  mockUpdateBillingAssignmentAmount: vi.fn(),
  mockUpdateSubscriptionAmount: vi.fn(),
  mockDeactivateBillingAssignmentsForProfiles: vi.fn(),
  mockUpdatePricing: vi.fn(),
}))

vi.mock('../billing-helpers', () => ({
  findFamilySubscription: (...args: unknown[]) =>
    mockFindFamilySubscription(...args),
  findLiveFamilySubscriptionIds: (...args: unknown[]) =>
    mockFindLiveFamilySubscriptionIds(...args),
  handleBillingDivergence: (...args: unknown[]) =>
    mockHandleBillingDivergence(...args),
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  findFamilyProfilesForWithdrawal: (...args: unknown[]) =>
    mockFindFamilyProfilesForWithdrawal(...args),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getActiveBillingAssignmentsForSubscription: (...args: unknown[]) =>
    mockGetActiveAssignmentsForSubscription(...args),
  createBillingAssignment: (...args: unknown[]) =>
    mockCreateBillingAssignment(...args),
  updateBillingAssignmentAmount: (...args: unknown[]) =>
    mockUpdateBillingAssignmentAmount(...args),
  updateSubscriptionAmount: (...args: unknown[]) =>
    mockUpdateSubscriptionAmount(...args),
  deactivateBillingAssignmentsForProfiles: (...args: unknown[]) =>
    mockDeactivateBillingAssignmentsForProfiles(...args),
  findFamilyLiveSubscriptions: (...args: unknown[]) =>
    mockFindFamilyLiveSubscriptions(...args),
}))

vi.mock('../subscription-pricing', () => ({
  updateDugsiSubscriptionPricing: (...args: unknown[]) =>
    mockUpdatePricing(...args),
}))

vi.mock('@/lib/stripe-dugsi', () => ({
  getDugsiStripeClient: () => ({}) as never,
}))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: (fn: (tx: string) => unknown) => fn('tx-client') },
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({}),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
}))

const FAMILY = 'fam-1'
const SUB = {
  id: 'sub-db-1',
  stripeSubscriptionId: 'sub_stripe1',
  amount: 16000,
  status: 'active',
}

const profiles = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    status: 'ENROLLED',
    person: { name: `Child ${i + 1}` },
  }))

beforeEach(() => {
  vi.clearAllMocks()
  mockFindLiveFamilySubscriptionIds.mockResolvedValue(['sub-db-1'])
  mockFindFamilySubscription.mockResolvedValue(SUB)
  mockFindFamilyLiveSubscriptions.mockResolvedValue([])
  mockFindFamilyProfilesForWithdrawal.mockResolvedValue(profiles(2))
  mockGetActiveAssignmentsForSubscription.mockResolvedValue([
    { id: 'a1', programProfileId: 'p1', amount: 8000 },
    { id: 'a2', programProfileId: 'p2', amount: 8000 },
  ])
  mockUpdatePricing.mockResolvedValue(undefined)
})

describe('syncFamilyBillingRate', () => {
  it('re-splits existing assignments to the calculated rate', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(profiles(3))
    mockGetActiveAssignmentsForSubscription.mockResolvedValueOnce([
      { id: 'a1', programProfileId: 'p1', amount: 8000 },
      { id: 'a2', programProfileId: 'p2', amount: 8000 },
      { id: 'a3', programProfileId: 'p3', amount: 7000 },
    ])
    const result = await syncFamilyBillingRate(FAMILY)
    expect(result.rate).toBe(23000)
    expect(mockUpdatePricing).toHaveBeenCalledWith(
      expect.anything(),
      'sub_stripe1',
      23000,
      expect.arrayContaining([expect.objectContaining({ id: 'p1' })]),
      { clearCancelAtPeriodEnd: true }
    )
    expect(mockUpdateBillingAssignmentAmount).toHaveBeenCalledTimes(3)
    expect(mockUpdateSubscriptionAmount).toHaveBeenCalledWith(
      'sub-db-1',
      23000,
      'tx-client'
    )
  })

  it('re-reads active assignments inside the transaction with the tx client', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(profiles(2))
    await syncFamilyBillingRate(FAMILY)
    expect(mockGetActiveAssignmentsForSubscription).toHaveBeenCalledWith(
      'sub-db-1',
      'tx-client'
    )
  })

  it('maps a P2034 serialization failure to a retryable 409', async () => {
    const p2034 = Object.assign(new Error('serialization failure'), {
      code: 'P2034',
    })
    mockUpdateSubscriptionAmount.mockRejectedValueOnce(p2034)
    await expect(syncFamilyBillingRate(FAMILY)).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT,
      statusCode: 409,
    })
    expect(mockHandleBillingDivergence).not.toHaveBeenCalled()
  })

  it('creates assignments for roster children without one', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(profiles(3))
    const result = await syncFamilyBillingRate(FAMILY)
    expect(mockCreateBillingAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub-db-1',
        programProfileId: 'p3',
      }),
      'tx-client'
    )
    expect(result.synced).toBe(true)
  })

  it('assignment shares sum exactly to the rate', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce(profiles(3))
    mockGetActiveAssignmentsForSubscription.mockResolvedValueOnce([])
    await syncFamilyBillingRate(FAMILY)
    const total = mockCreateBillingAssignment.mock.calls.reduce(
      (sum, [data]) => sum + data.amount,
      0
    )
    expect(total).toBe(23000)
  })

  it('refuses when family has multiple live subscriptions', async () => {
    mockFindLiveFamilySubscriptionIds.mockResolvedValueOnce(['s1', 's2'])
    await expect(syncFamilyBillingRate(FAMILY)).rejects.toThrow(
      /multiple active subscriptions/i
    )
    expect(mockUpdatePricing).not.toHaveBeenCalled()
  })

  it('no-ops with warning when family has no subscription', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(null)
    const result = await syncFamilyBillingRate(FAMILY)
    expect(result.synced).toBe(false)
    expect(result.warning).toMatch(/no active subscription/i)
    expect(mockUpdatePricing).not.toHaveBeenCalled()
  })

  it('no-ops with warning when roster is empty', async () => {
    mockFindFamilyProfilesForWithdrawal.mockResolvedValueOnce([])
    const result = await syncFamilyBillingRate(FAMILY)
    expect(result.synced).toBe(false)
    expect(mockUpdatePricing).not.toHaveBeenCalled()
  })

  it('warns when replacing an admin override', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce({
      ...SUB,
      amount: 20000,
    })
    const result = await syncFamilyBillingRate(FAMILY)
    expect(result.warning).toMatch(/override/i)
    expect(mockUpdatePricing).toHaveBeenCalled()
  })

  it('throws STRIPE_ERROR when the Stripe update fails, before any DB write', async () => {
    mockUpdatePricing.mockRejectedValueOnce(new Error('stripe down'))
    await expect(syncFamilyBillingRate(FAMILY)).rejects.toThrow(
      /Recalculate rate/
    )
    expect(mockUpdateBillingAssignmentAmount).not.toHaveBeenCalled()
    expect(mockUpdateSubscriptionAmount).not.toHaveBeenCalled()
  })

  it('deactivates active assignments for profiles no longer on the roster', async () => {
    mockGetActiveAssignmentsForSubscription.mockResolvedValueOnce([
      { id: 'a1', programProfileId: 'p1', amount: 8000 },
      { id: 'a2', programProfileId: 'p2', amount: 8000 },
      { id: 'stale-a', programProfileId: 'p-withdrawn', amount: 8000 },
    ])
    const result = await syncFamilyBillingRate(FAMILY)
    expect(mockDeactivateBillingAssignmentsForProfiles).toHaveBeenCalledWith(
      ['p-withdrawn'],
      expect.any(Date),
      'tx-client'
    )
    expect(mockUpdateBillingAssignmentAmount).toHaveBeenCalledWith(
      'a1',
      8000,
      'tx-client'
    )
    expect(mockUpdateBillingAssignmentAmount).toHaveBeenCalledWith(
      'a2',
      8000,
      'tx-client'
    )
    expect(result.synced).toBe(true)
  })

  it('returns divergence warning when DB fails after Stripe success', async () => {
    mockUpdateSubscriptionAmount.mockRejectedValueOnce(new Error('db down'))
    mockHandleBillingDivergence.mockResolvedValueOnce(
      'Stripe updated but DB update failed. Check logs for details.'
    )
    const result = await syncFamilyBillingRate(FAMILY)
    expect(result.synced).toBe(true)
    expect(result.warning).toMatch(/DB update failed/)
  })

  it('falls back to the family-scoped live subscription when no active-assignment subscription is found (fully-withdrawn re-enroll)', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(null)
    mockFindFamilyLiveSubscriptions.mockResolvedValueOnce([SUB])
    const result = await syncFamilyBillingRate(FAMILY)
    expect(mockUpdatePricing).toHaveBeenCalledWith(
      expect.anything(),
      'sub_stripe1',
      expect.any(Number),
      expect.anything(),
      { clearCancelAtPeriodEnd: true }
    )
    expect(result.synced).toBe(true)
    expect(mockUpdateSubscriptionAmount).toHaveBeenCalledWith(
      'sub-db-1',
      expect.any(Number),
      'tx-client'
    )
  })

  it('falls back to a trialing subscription for a fully-withdrawn re-enroll', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(null)
    mockFindFamilyLiveSubscriptions.mockResolvedValueOnce([
      { ...SUB, status: 'trialing' },
    ])
    const result = await syncFamilyBillingRate(FAMILY)
    expect(mockUpdatePricing).toHaveBeenCalledWith(
      expect.anything(),
      'sub_stripe1',
      expect.any(Number),
      expect.anything(),
      { clearCancelAtPeriodEnd: true }
    )
    expect(result.synced).toBe(true)
  })

  it('still returns the "needs a new checkout" warning when the fallback also finds nothing', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(null)
    mockFindFamilyLiveSubscriptions.mockResolvedValueOnce([])
    const result = await syncFamilyBillingRate(FAMILY)
    expect(result.synced).toBe(false)
    expect(result.warning).toMatch(/needs a new checkout/i)
    expect(mockUpdatePricing).not.toHaveBeenCalled()
  })

  it('409s when the fallback finds multiple live subscriptions', async () => {
    mockFindFamilySubscription.mockResolvedValueOnce(null)
    mockFindFamilyLiveSubscriptions.mockResolvedValueOnce([
      SUB,
      { ...SUB, id: 'sub-db-2' },
    ])
    await expect(syncFamilyBillingRate(FAMILY)).rejects.toThrow(
      /multiple active subscriptions/i
    )
    expect(mockUpdatePricing).not.toHaveBeenCalled()
  })

  it('rethrows an ActionError from the Stripe pricing helper unwrapped instead of collapsing it into the generic Stripe-error message', async () => {
    const configError = new ActionError(
      'Stripe product not configured for Dugsi',
      ERROR_CODES.STRIPE_ERROR
    )
    mockUpdatePricing.mockRejectedValueOnce(configError)
    await expect(syncFamilyBillingRate(FAMILY)).rejects.toBe(configError)
  })
})
