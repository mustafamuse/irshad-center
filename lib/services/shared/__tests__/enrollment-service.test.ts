import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetSubscriptionByStripeId,
  mockGetBillingAssignmentsBySubscription,
  mockGetActiveEnrollment,
  mockUpdateEnrollmentStatus,
  mockUpdateProgramProfileStatus,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetSubscriptionByStripeId: vi.fn(),
  mockGetBillingAssignmentsBySubscription: vi.fn(),
  mockGetActiveEnrollment: vi.fn(),
  mockUpdateEnrollmentStatus: vi.fn(),
  mockUpdateProgramProfileStatus: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getSubscriptionByStripeId: (...args: unknown[]) =>
    mockGetSubscriptionByStripeId(...args),
  getBillingAssignmentsBySubscription: (...args: unknown[]) =>
    mockGetBillingAssignmentsBySubscription(...args),
}))

vi.mock('@/lib/db/queries/enrollment', () => ({
  getActiveEnrollment: (...args: unknown[]) => mockGetActiveEnrollment(...args),
  updateEnrollmentStatus: (...args: unknown[]) =>
    mockUpdateEnrollmentStatus(...args),
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  updateProgramProfileStatus: (...args: unknown[]) =>
    mockUpdateProgramProfileStatus(...args),
}))

vi.mock('@/lib/logger', () => {
  const stub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
  return {
    logger: stub,
    createServiceLogger: () => stub,
    logError: vi.fn(),
  }
})

import { handleSubscriptionCancellationEnrollments } from '../enrollment-service'

const STRIPE_SUB_ID = 'sub_test_123'

function makeAssignment(opts: {
  profileId: string
  program: 'DUGSI_PROGRAM' | 'MAHAD_PROGRAM'
  isActive?: boolean
  status?: 'ENROLLED' | 'WITHDRAWN' | 'COMPLETED'
}) {
  return {
    id: `ba_${opts.profileId}`,
    programProfileId: opts.profileId,
    isActive: opts.isActive ?? true,
    programProfile: {
      id: opts.profileId,
      program: opts.program,
      status: opts.status ?? 'ENROLLED',
    },
  }
}

describe('handleSubscriptionCancellationEnrollments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSubscriptionByStripeId.mockResolvedValue({ id: 'db_sub_1' })
    mockGetActiveEnrollment.mockResolvedValue({
      id: 'enr_1',
      status: 'ENROLLED',
    })
    mockUpdateEnrollmentStatus.mockResolvedValue(undefined)
    mockUpdateProgramProfileStatus.mockResolvedValue(undefined)
    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({})
    )
  })

  it('flips both Enrollment and ProgramProfile to WITHDRAWN for Dugsi', async () => {
    mockGetBillingAssignmentsBySubscription.mockResolvedValue([
      makeAssignment({ profileId: 'p_dugsi', program: 'DUGSI_PROGRAM' }),
    ])

    const result =
      await handleSubscriptionCancellationEnrollments(STRIPE_SUB_ID)

    expect(result.withdrawn).toBe(1)
    expect(result.profilesWithdrawn).toBe(1)
    expect(mockUpdateEnrollmentStatus).toHaveBeenCalledWith(
      'enr_1',
      'WITHDRAWN',
      expect.any(String),
      expect.any(Date),
      expect.anything()
    )
    expect(mockUpdateProgramProfileStatus).toHaveBeenCalledWith(
      'p_dugsi',
      'WITHDRAWN',
      expect.anything()
    )
  })

  it('flips only Enrollment (not ProgramProfile) for Mahad', async () => {
    mockGetBillingAssignmentsBySubscription.mockResolvedValue([
      makeAssignment({ profileId: 'p_mahad', program: 'MAHAD_PROGRAM' }),
    ])

    const result =
      await handleSubscriptionCancellationEnrollments(STRIPE_SUB_ID)

    expect(result.withdrawn).toBe(1)
    expect(result.profilesWithdrawn).toBe(0)
    expect(mockUpdateEnrollmentStatus).toHaveBeenCalledTimes(1)
    expect(mockUpdateProgramProfileStatus).not.toHaveBeenCalled()
  })

  it('skips assignments that are already inactive', async () => {
    mockGetBillingAssignmentsBySubscription.mockResolvedValue([
      makeAssignment({
        profileId: 'p_inactive',
        program: 'DUGSI_PROGRAM',
        isActive: false,
      }),
    ])

    const result =
      await handleSubscriptionCancellationEnrollments(STRIPE_SUB_ID)

    expect(result.withdrawn).toBe(0)
    expect(result.profilesWithdrawn).toBe(0)
    expect(mockUpdateEnrollmentStatus).not.toHaveBeenCalled()
    expect(mockUpdateProgramProfileStatus).not.toHaveBeenCalled()
  })

  it('does not re-flip a Dugsi profile that is already WITHDRAWN', async () => {
    mockGetBillingAssignmentsBySubscription.mockResolvedValue([
      makeAssignment({
        profileId: 'p_already',
        program: 'DUGSI_PROGRAM',
        status: 'WITHDRAWN',
      }),
    ])

    const result =
      await handleSubscriptionCancellationEnrollments(STRIPE_SUB_ID)

    expect(result.profilesWithdrawn).toBe(0)
    expect(mockUpdateProgramProfileStatus).not.toHaveBeenCalled()
  })

  it('returns empty result when subscription is not in DB', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue(null)
    mockGetBillingAssignmentsBySubscription.mockResolvedValue([])

    const result =
      await handleSubscriptionCancellationEnrollments(STRIPE_SUB_ID)

    expect(result.withdrawn).toBe(0)
    expect(result.profilesWithdrawn).toBe(0)
    expect(mockGetBillingAssignmentsBySubscription).not.toHaveBeenCalled()
  })

  it('skips enrollment row update when enrollment status is COMPLETED', async () => {
    mockGetBillingAssignmentsBySubscription.mockResolvedValue([
      makeAssignment({ profileId: 'p_completed', program: 'DUGSI_PROGRAM' }),
    ])
    mockGetActiveEnrollment.mockResolvedValue({
      id: 'enr_completed',
      status: 'COMPLETED',
    })

    const result =
      await handleSubscriptionCancellationEnrollments(STRIPE_SUB_ID)

    expect(result.withdrawn).toBe(0)
    expect(result.profilesWithdrawn).toBe(1) // profile (ENROLLED) still flipped; enrollment row skipped
    expect(mockUpdateEnrollmentStatus).not.toHaveBeenCalled()
  })

  it('does not flip a COMPLETED Dugsi profile to WITHDRAWN — graduated ≠ dropped out', async () => {
    mockGetBillingAssignmentsBySubscription.mockResolvedValue([
      makeAssignment({
        profileId: 'p_graduated',
        program: 'DUGSI_PROGRAM',
        status: 'COMPLETED',
      }),
    ])

    const result =
      await handleSubscriptionCancellationEnrollments(STRIPE_SUB_ID)

    expect(result.profilesWithdrawn).toBe(0)
    expect(mockUpdateProgramProfileStatus).not.toHaveBeenCalled()
  })

  it('propagates errors so the outer transaction rolls back', async () => {
    mockGetBillingAssignmentsBySubscription.mockResolvedValue([
      makeAssignment({ profileId: 'p_dugsi', program: 'DUGSI_PROGRAM' }),
    ])
    mockUpdateEnrollmentStatus.mockRejectedValue(
      new Error('simulated DB failure')
    )

    await expect(
      handleSubscriptionCancellationEnrollments(STRIPE_SUB_ID)
    ).rejects.toThrow('simulated DB failure')
    expect(mockUpdateProgramProfileStatus).not.toHaveBeenCalled()
  })
})
