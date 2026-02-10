import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockProgramProfileFindUnique,
  mockProgramProfileFindMany,
  mockProgramProfileCount,
  mockProgramProfileUpdate,
  mockEnrollmentUpdate,
  mockEnrollmentCreate,
  mockBillingAssignmentFindFirst,
  mockBillingAssignmentUpdate,
  mockBillingAssignmentUpdateMany,
  mockBillingAssignmentCreate,
  mockDugsiClassEnrollmentUpdate,
  mockSubscriptionUpdate,
  mockTransaction,
} = vi.hoisted(() => {
  const mockProgramProfileFindUnique = vi.fn()
  const mockProgramProfileFindMany = vi.fn()
  const mockProgramProfileCount = vi.fn()
  const mockProgramProfileUpdate = vi.fn()
  const mockEnrollmentUpdate = vi.fn()
  const mockEnrollmentCreate = vi.fn()
  const mockBillingAssignmentFindFirst = vi.fn()
  const mockBillingAssignmentUpdate = vi.fn()
  const mockBillingAssignmentUpdateMany = vi.fn()
  const mockBillingAssignmentCreate = vi.fn()
  const mockDugsiClassEnrollmentUpdate = vi.fn()
  const mockSubscriptionUpdate = vi.fn()

  const tx = {
    programProfile: {
      update: (...args: unknown[]) => mockProgramProfileUpdate(...args),
    },
    enrollment: {
      update: (...args: unknown[]) => mockEnrollmentUpdate(...args),
      create: (...args: unknown[]) => mockEnrollmentCreate(...args),
    },
    billingAssignment: {
      update: (...args: unknown[]) => mockBillingAssignmentUpdate(...args),
      create: (...args: unknown[]) => mockBillingAssignmentCreate(...args),
    },
    dugsiClassEnrollment: {
      update: (...args: unknown[]) => mockDugsiClassEnrollmentUpdate(...args),
    },
  }

  const mockTransaction = vi.fn(
    async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)
  )

  return {
    mockProgramProfileFindUnique,
    mockProgramProfileFindMany,
    mockProgramProfileCount,
    mockProgramProfileUpdate,
    mockEnrollmentUpdate,
    mockEnrollmentCreate,
    mockBillingAssignmentFindFirst,
    mockBillingAssignmentUpdate,
    mockBillingAssignmentUpdateMany,
    mockBillingAssignmentCreate,
    mockDugsiClassEnrollmentUpdate,
    mockSubscriptionUpdate,
    mockTransaction,
  }
})

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findUnique: (...args: unknown[]) => mockProgramProfileFindUnique(...args),
      findMany: (...args: unknown[]) => mockProgramProfileFindMany(...args),
      count: (...args: unknown[]) => mockProgramProfileCount(...args),
    },
    enrollment: {
      update: (...args: unknown[]) => mockEnrollmentUpdate(...args),
      create: (...args: unknown[]) => mockEnrollmentCreate(...args),
    },
    billingAssignment: {
      findFirst: (...args: unknown[]) =>
        mockBillingAssignmentFindFirst(...args),
      update: (...args: unknown[]) => mockBillingAssignmentUpdate(...args),
      updateMany: (...args: unknown[]) =>
        mockBillingAssignmentUpdateMany(...args),
      create: (...args: unknown[]) => mockBillingAssignmentCreate(...args),
    },
    dugsiClassEnrollment: {
      update: (...args: unknown[]) => mockDugsiClassEnrollmentUpdate(...args),
    },
    subscription: {
      update: (...args: unknown[]) => mockSubscriptionUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

const mockStripe = {
  subscriptions: {
    retrieve: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  },
}

vi.mock('@/lib/stripe-dugsi', () => ({
  getDugsiStripeClient: vi.fn(() => mockStripe),
}))

vi.mock('@/lib/keys/stripe', () => ({
  getDugsiKeys: vi.fn(() => ({
    secretKey: 'sk_test',
    webhookSecret: 'whsec_test',
    productId: 'prod_test',
  })),
}))

vi.mock('@/lib/constants/dugsi', () => ({
  DUGSI_PROGRAM: 'DUGSI_PROGRAM',
}))

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, fn: () => Promise<unknown>) => fn()),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
}))

vi.mock('@/lib/utils/dugsi-tuition', () => ({
  calculateDugsiRate: vi.fn((count: number) => count * 8000),
}))

import {
  withdrawChild,
  reEnrollChild,
  getWithdrawPreview,
  pauseFamilyBilling,
  resumeFamilyBilling,
} from '../withdrawal-service'

function makeActiveProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'student-1',
    program: 'DUGSI_PROGRAM',
    status: 'ENROLLED',
    familyReferenceId: 'family-1',
    person: { id: 'person-1', name: 'Ali Hassan' },
    enrollments: [{ id: 'enrollment-1', status: 'ENROLLED' }],
    assignments: [
      {
        id: 'assignment-1',
        isActive: true,
        subscription: {
          id: 'sub-1',
          stripeSubscriptionId: 'sub_stripe_1',
          stripeAccountType: 'DUGSI',
          status: 'active',
          amount: 8000,
        },
      },
    ],
    dugsiClassEnrollment: { id: 'class-enroll-1', isActive: true },
    ...overrides,
  }
}

function makeSubscriptionAssignment(status = 'active', amount = 8000) {
  return {
    subscription: {
      id: 'sub-1',
      stripeSubscriptionId: 'sub_stripe_1',
      stripeAccountType: 'DUGSI',
      status,
      amount,
    },
  }
}

const baseWithdrawInput = {
  studentId: 'student-1',
  reason: 'family_moved' as const,
  billingAdjustment: { type: 'auto_recalculate' as const },
}

describe('withdrawChild', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ id: 'si_item_1' }] },
    })
    mockStripe.subscriptions.update.mockResolvedValue({})
    mockStripe.subscriptions.cancel.mockResolvedValue({})
  })

  it('should set WITHDRAWN status, deactivate billing and class enrollment, close enrollment', async () => {
    const profile = makeActiveProfile()
    mockProgramProfileFindUnique
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ familyReferenceId: 'family-1' })
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )
    mockProgramProfileCount.mockResolvedValue(1)

    const result = await withdrawChild(baseWithdrawInput)

    expect(result.withdrawn).toBe(true)
    expect(mockProgramProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'student-1' },
        data: { status: 'WITHDRAWN' },
      })
    )
    expect(mockEnrollmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'enrollment-1' },
        data: expect.objectContaining({ status: 'WITHDRAWN' }),
      })
    )
    expect(mockBillingAssignmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'assignment-1' },
        data: expect.objectContaining({ isActive: false }),
      })
    )
    expect(mockDugsiClassEnrollmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'class-enroll-1' },
        data: expect.objectContaining({ isActive: false }),
      })
    )
  })

  it('should call stripe.subscriptions.update with recalculated amount for auto_recalculate', async () => {
    const profile = makeActiveProfile()
    mockProgramProfileFindUnique
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ familyReferenceId: 'family-1' })
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )
    mockProgramProfileCount.mockResolvedValue(2)

    const result = await withdrawChild(baseWithdrawInput)

    expect(result.billingUpdated).toBe(true)
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_stripe_1',
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 'si_item_1',
            price_data: expect.objectContaining({
              unit_amount: 16000,
              product: 'prod_test',
            }),
          }),
        ],
      })
    )
  })

  it('should not call Stripe update for keep_current', async () => {
    const profile = makeActiveProfile()
    mockProgramProfileFindUnique
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ familyReferenceId: 'family-1' })
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )

    const result = await withdrawChild({
      ...baseWithdrawInput,
      billingAdjustment: { type: 'keep_current' },
    })

    expect(result.billingUpdated).toBe(true)
    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled()
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled()
  })

  it('should call Stripe with custom amount for custom billing adjustment', async () => {
    const profile = makeActiveProfile()
    mockProgramProfileFindUnique
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ familyReferenceId: 'family-1' })
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )

    const result = await withdrawChild({
      ...baseWithdrawInput,
      billingAdjustment: { type: 'custom', amount: 5000 },
    })

    expect(result.billingUpdated).toBe(true)
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_stripe_1',
      expect.objectContaining({
        items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 5000 }),
          }),
        ],
      })
    )
  })

  it('should cancel subscription for cancel_subscription when last child', async () => {
    const profile = makeActiveProfile()
    mockProgramProfileFindUnique
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ familyReferenceId: 'family-1' })
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )

    const result = await withdrawChild({
      ...baseWithdrawInput,
      billingAdjustment: { type: 'cancel_subscription' },
    })

    expect(result.billingUpdated).toBe(true)
    expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_stripe_1')
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: { status: 'canceled' },
      })
    )
    expect(mockBillingAssignmentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { subscriptionId: 'sub-1', isActive: true },
      })
    )
  })

  it('should throw ALREADY_WITHDRAWN for already withdrawn student', async () => {
    const profile = makeActiveProfile({ status: 'WITHDRAWN' })
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)

    await expect(withdrawChild(baseWithdrawInput)).rejects.toThrow(
      'Student is already withdrawn'
    )
  })

  it('should throw STUDENT_NOT_FOUND when profile does not exist', async () => {
    mockProgramProfileFindUnique.mockResolvedValueOnce(null)

    await expect(withdrawChild(baseWithdrawInput)).rejects.toThrow(
      'Student not found'
    )
  })

  it('should skip Stripe and return success when no active subscription', async () => {
    const profile = makeActiveProfile({ assignments: [] })
    mockProgramProfileFindUnique
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ familyReferenceId: 'family-1' })
    mockBillingAssignmentFindFirst.mockResolvedValue(null)

    const result = await withdrawChild(baseWithdrawInput)

    expect(result.withdrawn).toBe(true)
    expect(result.billingUpdated).toBe(true)
    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it('should return billingUpdated: false with error when Stripe fails', async () => {
    const profile = makeActiveProfile()
    mockProgramProfileFindUnique
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ familyReferenceId: 'family-1' })
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )
    mockProgramProfileCount.mockResolvedValue(2)
    mockStripe.subscriptions.retrieve.mockRejectedValue(
      new Error('Stripe API error')
    )

    const result = await withdrawChild(baseWithdrawInput)

    expect(result.withdrawn).toBe(true)
    expect(result.billingUpdated).toBe(false)
    expect(result.billingError).toBe('Stripe API error')
  })

  it('should store reason in Enrollment record', async () => {
    const profile = makeActiveProfile()
    mockProgramProfileFindUnique
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ familyReferenceId: 'family-1' })
    mockBillingAssignmentFindFirst.mockResolvedValue(null)

    await withdrawChild({
      ...baseWithdrawInput,
      reason: 'financial',
      reasonNote: 'Cannot afford tuition',
    })

    expect(mockEnrollmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'Financial reasons: Cannot afford tuition',
        }),
      })
    )
  })
})

describe('reEnrollChild', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ id: 'si_item_1' }] },
    })
    mockStripe.subscriptions.update.mockResolvedValue({})
  })

  it('should set ENROLLED status and create new Enrollment for withdrawn child', async () => {
    const profile = makeActiveProfile({
      status: 'WITHDRAWN',
      assignments: [],
    })
    mockProgramProfileFindUnique
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ familyReferenceId: 'family-1' })
    mockBillingAssignmentFindFirst
      .mockResolvedValueOnce(makeSubscriptionAssignment())
      .mockResolvedValueOnce(makeSubscriptionAssignment())
    mockProgramProfileCount.mockResolvedValue(2)

    const result = await reEnrollChild({
      studentId: 'student-1',
      billingAdjustment: { type: 'auto_recalculate' },
    })

    expect(result.reEnrolled).toBe(true)
    expect(mockProgramProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'student-1' },
        data: { status: 'ENROLLED' },
      })
    )
    expect(mockEnrollmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          programProfileId: 'student-1',
          status: 'ENROLLED',
        }),
      })
    )
  })

  it('should throw NOT_WITHDRAWN when student is not withdrawn', async () => {
    const profile = makeActiveProfile({ status: 'ENROLLED' })
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)

    await expect(
      reEnrollChild({
        studentId: 'student-1',
        billingAdjustment: { type: 'auto_recalculate' },
      })
    ).rejects.toThrow('Student is not withdrawn')
  })
})

describe('pauseFamilyBilling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStripe.subscriptions.update.mockResolvedValue({})
  })

  it('should call pause_collection on Stripe and update DB status', async () => {
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment('active')
    )

    await pauseFamilyBilling('family-1')

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_stripe_1',
      { pause_collection: { behavior: 'void' } }
    )
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: { status: 'paused' },
      })
    )
  })
})

describe('resumeFamilyBilling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStripe.subscriptions.update.mockResolvedValue({})
  })

  it('should clear pause_collection on Stripe and update DB status', async () => {
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment('paused')
    )

    await resumeFamilyBilling('family-1')

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_stripe_1',
      { pause_collection: '' }
    )
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: { status: 'active' },
      })
    )
  })
})

describe('getWithdrawPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return correct preview data with recalculated amount', async () => {
    mockProgramProfileFindUnique.mockResolvedValue({
      id: 'student-1',
      program: 'DUGSI_PROGRAM',
      familyReferenceId: 'family-1',
      person: { name: 'Ali Hassan' },
    })
    mockProgramProfileFindMany.mockResolvedValue([
      { id: 'student-1' },
      { id: 'student-2' },
      { id: 'student-3' },
    ])
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment('active', 23000)
    )

    const preview = await getWithdrawPreview('student-1')

    expect(preview.childName).toBe('Ali Hassan')
    expect(preview.activeChildrenCount).toBe(3)
    expect(preview.currentAmount).toBe(23000)
    expect(preview.recalculatedAmount).toBe(16000)
    expect(preview.isLastActiveChild).toBe(false)
    expect(preview.hasActiveSubscription).toBe(true)
    expect(preview.isPaused).toBe(false)
  })
})
