import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockProgramProfileFindUnique,
  mockProgramProfileFindMany,
  mockProgramProfileCount,
  mockProgramProfileCountTx,
  mockProgramProfileUpdate,
  mockEnrollmentUpdate,
  mockEnrollmentCreate,
  mockBillingAssignmentFindFirst,
  mockBillingAssignmentUpdate,
  mockBillingAssignmentUpdateMany,
  mockBillingAssignmentUpdateManyTx,
  mockBillingAssignmentCreate,
  mockDugsiClassEnrollmentUpdate,
  mockSubscriptionUpdate,
  mockTransaction,
} = vi.hoisted(() => {
  const mockProgramProfileFindUnique = vi.fn()
  const mockProgramProfileFindMany = vi.fn()
  const mockProgramProfileCount = vi.fn()
  const mockProgramProfileCountTx = vi.fn()
  const mockProgramProfileUpdate = vi.fn()
  const mockEnrollmentUpdate = vi.fn()
  const mockEnrollmentCreate = vi.fn()
  const mockBillingAssignmentFindFirst = vi.fn()
  const mockBillingAssignmentUpdate = vi.fn()
  const mockBillingAssignmentUpdateMany = vi.fn()
  const mockBillingAssignmentUpdateManyTx = vi.fn()
  const mockBillingAssignmentCreate = vi.fn()
  const mockDugsiClassEnrollmentUpdate = vi.fn()
  const mockSubscriptionUpdate = vi.fn()

  const tx = {
    programProfile: {
      findMany: (...args: unknown[]) => mockProgramProfileFindMany(...args),
      update: (...args: unknown[]) => mockProgramProfileUpdate(...args),
      count: (...args: unknown[]) => mockProgramProfileCountTx(...args),
    },
    enrollment: {
      update: (...args: unknown[]) => mockEnrollmentUpdate(...args),
      create: (...args: unknown[]) => mockEnrollmentCreate(...args),
    },
    billingAssignment: {
      update: (...args: unknown[]) => mockBillingAssignmentUpdate(...args),
      updateMany: (...args: unknown[]) =>
        mockBillingAssignmentUpdateManyTx(...args),
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
    mockProgramProfileCountTx,
    mockProgramProfileUpdate,
    mockEnrollmentUpdate,
    mockEnrollmentCreate,
    mockBillingAssignmentFindFirst,
    mockBillingAssignmentUpdate,
    mockBillingAssignmentUpdateMany,
    mockBillingAssignmentUpdateManyTx,
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

import { logError } from '@/lib/logger'

import {
  withdrawChild,
  withdrawFamily,
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
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
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
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
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

  it('should cancel subscription for cancel_subscription', async () => {
    const profile = makeActiveProfile()
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)

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

  it('should auto-cancel when auto_recalculate yields 0 remaining children', async () => {
    const profile = makeActiveProfile()
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
    mockProgramProfileCount.mockResolvedValue(0)

    const result = await withdrawChild(baseWithdrawInput)

    expect(result.billingUpdated).toBe(true)
    expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_stripe_1')
    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled()
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
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)

    const result = await withdrawChild(baseWithdrawInput)

    expect(result.withdrawn).toBe(true)
    expect(result.billingUpdated).toBe(true)
    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it('should return billingUpdated: false with error when Stripe fails', async () => {
    const profile = makeActiveProfile()
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
    mockProgramProfileCount.mockResolvedValue(2)
    mockStripe.subscriptions.retrieve.mockRejectedValue(
      new Error('Stripe API error')
    )

    const result = await withdrawChild(baseWithdrawInput)

    expect(result.withdrawn).toBe(true)
    expect(result.billingUpdated).toBe(false)
    expect(result.billingError).toBe('Stripe API error')
    expect(logError).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Error),
      expect.stringContaining('Billing adjustment failed'),
      expect.objectContaining({ subscriptionId: 'sub_stripe_1' })
    )
  })

  it('should store reason in Enrollment record', async () => {
    const profile = makeActiveProfile()
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
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

  it('should return billingUpdated: false when cancel_subscription and no subscription', async () => {
    const profile = makeActiveProfile({ assignments: [] })
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)

    const result = await withdrawChild({
      ...baseWithdrawInput,
      billingAdjustment: { type: 'cancel_subscription' },
    })

    expect(result.withdrawn).toBe(true)
    expect(result.billingUpdated).toBe(false)
    expect(result.billingError).toContain('No active subscription')
  })

  describe('applyBillingAdjustment Stripe/DB divergence', () => {
    it('should log CRITICAL when DB fails after Stripe cancel for cancel_subscription', async () => {
      const profile = makeActiveProfile()
      mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
      mockSubscriptionUpdate.mockRejectedValueOnce(new Error('DB fail'))

      const result = await withdrawChild({
        ...baseWithdrawInput,
        billingAdjustment: { type: 'cancel_subscription' },
      })

      expect(logError).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Error),
        expect.stringContaining('CRITICAL'),
        expect.objectContaining({
          stripeSubscriptionId: 'sub_stripe_1',
          operation: 'cancel_subscription',
        })
      )
      expect(result.billingUpdated).toBe(false)
    })

    it('should log CRITICAL when DB fails after Stripe cancel for auto_recalculate zero children', async () => {
      const profile = makeActiveProfile()
      mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
      mockProgramProfileCount.mockResolvedValue(0)
      mockSubscriptionUpdate.mockRejectedValueOnce(new Error('DB fail'))

      const result = await withdrawChild(baseWithdrawInput)

      expect(logError).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Error),
        expect.stringContaining('CRITICAL'),
        expect.objectContaining({
          stripeSubscriptionId: 'sub_stripe_1',
          operation: 'auto_recalculate_cancel',
        })
      )
      expect(result.billingUpdated).toBe(false)
    })

    it('should log CRITICAL when DB fails after Stripe amount update', async () => {
      const profile = makeActiveProfile()
      mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
      mockProgramProfileCount.mockResolvedValue(2)
      mockSubscriptionUpdate.mockRejectedValueOnce(new Error('DB fail'))

      const result = await withdrawChild(baseWithdrawInput)

      expect(logError).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Error),
        expect.stringContaining('CRITICAL'),
        expect.objectContaining({
          stripeSubscriptionId: 'sub_stripe_1',
          operation: 'amount_update',
        })
      )
      expect(result.billingUpdated).toBe(false)
    })
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
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )
    mockProgramProfileCountTx.mockResolvedValue(2)
    mockProgramProfileCount.mockResolvedValue(3)

    const result = await reEnrollChild({ studentId: 'student-1' })

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

  it('should always auto-recalculate billing via Stripe', async () => {
    const profile = makeActiveProfile({
      status: 'WITHDRAWN',
      assignments: [],
    })
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )
    mockProgramProfileCountTx.mockResolvedValue(1)
    mockProgramProfileCount.mockResolvedValue(2)

    const result = await reEnrollChild({ studentId: 'student-1' })

    expect(result.billingUpdated).toBe(true)
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_stripe_1',
      expect.objectContaining({
        items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 16000,
            }),
          }),
        ],
      })
    )
  })

  it('should throw NOT_WITHDRAWN when student is not withdrawn', async () => {
    const profile = makeActiveProfile({ status: 'ENROLLED' })
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)

    await expect(reEnrollChild({ studentId: 'student-1' })).rejects.toThrow(
      'Student is not withdrawn'
    )
  })

  it('should throw STUDENT_NOT_FOUND when student does not exist', async () => {
    mockProgramProfileFindUnique.mockResolvedValueOnce(null)

    await expect(reEnrollChild({ studentId: 'nonexistent' })).rejects.toThrow(
      'Student not found'
    )
  })

  it('should return billingUpdated: false with error when no subscription', async () => {
    const profile = makeActiveProfile({
      status: 'WITHDRAWN',
      assignments: [],
    })
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
    mockBillingAssignmentFindFirst.mockResolvedValue(null)
    mockProgramProfileCountTx.mockResolvedValue(0)

    const result = await reEnrollChild({ studentId: 'student-1' })

    expect(result.reEnrolled).toBe(true)
    expect(result.billingUpdated).toBe(false)
    expect(result.billingError).toContain('No active subscription')
    expect(mockBillingAssignmentCreate).not.toHaveBeenCalled()
    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it('should create BillingAssignment with calculated rate, not zero', async () => {
    const profile = makeActiveProfile({
      status: 'WITHDRAWN',
      assignments: [],
    })
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )
    mockProgramProfileCountTx.mockResolvedValue(1)
    mockProgramProfileCount.mockResolvedValue(2)

    await reEnrollChild({ studentId: 'student-1' })

    expect(mockBillingAssignmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 16000,
        }),
      })
    )
  })

  it('should query activeCount inside the transaction', async () => {
    const profile = makeActiveProfile({
      status: 'WITHDRAWN',
      assignments: [],
    })
    mockProgramProfileFindUnique.mockResolvedValueOnce(profile)
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )
    mockProgramProfileCountTx.mockResolvedValue(2)
    mockProgramProfileCount.mockResolvedValue(3)

    await reEnrollChild({ studentId: 'student-1' })

    expect(mockProgramProfileCountTx).toHaveBeenCalled()
    expect(mockProgramProfileCount).toHaveBeenCalled()
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

  it('should throw NO_ACTIVE_SUBSCRIPTION when no subscription exists', async () => {
    mockBillingAssignmentFindFirst.mockResolvedValue(null)

    await expect(pauseFamilyBilling('family-1')).rejects.toThrow(
      'No active subscription found for this family'
    )
  })

  it('should throw INVALID_INPUT when subscription is already paused', async () => {
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment('paused')
    )

    await expect(pauseFamilyBilling('family-1')).rejects.toThrow(
      'Cannot pause subscription with status "paused"'
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
      { pause_collection: null }
    )
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: { status: 'active' },
      })
    )
  })

  it('should throw NO_ACTIVE_SUBSCRIPTION when no subscription exists', async () => {
    mockBillingAssignmentFindFirst.mockResolvedValue(null)

    await expect(resumeFamilyBilling('family-1')).rejects.toThrow(
      'No subscription found for this family'
    )
  })

  it('should throw INVALID_INPUT when subscription is not paused', async () => {
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment('active')
    )

    await expect(resumeFamilyBilling('family-1')).rejects.toThrow(
      'Cannot resume subscription with status "active"'
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
    mockProgramProfileCount.mockResolvedValue(3)
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

  it('should throw STUDENT_NOT_FOUND when student does not exist', async () => {
    mockProgramProfileFindUnique.mockResolvedValue(null)

    await expect(getWithdrawPreview('nonexistent')).rejects.toThrow(
      'Student not found'
    )
  })

  it('should return isLastActiveChild: true when only one active child', async () => {
    mockProgramProfileFindUnique.mockResolvedValue({
      id: 'student-1',
      program: 'DUGSI_PROGRAM',
      familyReferenceId: 'family-1',
      person: { name: 'Ali Hassan' },
    })
    mockProgramProfileCount.mockResolvedValue(1)
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment('active')
    )

    const preview = await getWithdrawPreview('student-1')

    expect(preview.isLastActiveChild).toBe(true)
  })

  it('should return hasActiveSubscription: false when no subscription', async () => {
    mockProgramProfileFindUnique.mockResolvedValue({
      id: 'student-1',
      program: 'DUGSI_PROGRAM',
      familyReferenceId: 'family-1',
      person: { name: 'Ali Hassan' },
    })
    mockProgramProfileCount.mockResolvedValue(2)
    mockBillingAssignmentFindFirst.mockResolvedValue(null)

    const preview = await getWithdrawPreview('student-1')

    expect(preview.hasActiveSubscription).toBe(false)
    expect(preview.currentAmount).toBeNull()
  })
})

describe('withdrawFamily', () => {
  const baseInput = {
    familyReferenceId: 'family-1',
    reason: 'family_moved' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockStripe.subscriptions.cancel.mockResolvedValue({})
  })

  it('should atomically withdraw all active children in a single transaction', async () => {
    const profiles = [
      makeActiveProfile({
        id: 'student-1',
        person: { id: 'person-1', name: 'Ali Hassan' },
      }),
      makeActiveProfile({
        id: 'student-2',
        person: { id: 'person-2', name: 'Fatima Hassan' },
      }),
    ]
    mockBillingAssignmentFindFirst.mockResolvedValue(null)
    mockProgramProfileFindMany.mockResolvedValue(profiles)

    const result = await withdrawFamily(baseInput)

    expect(result.withdrawnCount).toBe(2)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockProgramProfileUpdate).toHaveBeenCalledTimes(2)
    expect(mockProgramProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'student-1' },
        data: { status: 'WITHDRAWN' },
      })
    )
    expect(mockProgramProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'student-2' },
        data: { status: 'WITHDRAWN' },
      })
    )
    expect(mockEnrollmentUpdate).toHaveBeenCalledTimes(2)
    expect(mockDugsiClassEnrollmentUpdate).toHaveBeenCalledTimes(2)
  })

  it('should cancel the subscription with a single Stripe call', async () => {
    const profiles = [
      makeActiveProfile({
        id: 'student-1',
        person: { id: 'person-1', name: 'Ali Hassan' },
      }),
    ]
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )
    mockProgramProfileFindMany.mockResolvedValue(profiles)

    const result = await withdrawFamily(baseInput)

    expect(result.billingCanceled).toBe(true)
    expect(mockStripe.subscriptions.cancel).toHaveBeenCalledTimes(1)
    expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_stripe_1')
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: { status: 'canceled' },
      })
    )
  })

  it('should throw when no active children exist', async () => {
    mockBillingAssignmentFindFirst.mockResolvedValue(null)
    mockProgramProfileFindMany.mockResolvedValue([])

    await expect(withdrawFamily(baseInput)).rejects.toThrow(
      'No active children to withdraw'
    )
  })

  it('should return billingError when Stripe cancel fails', async () => {
    const profiles = [
      makeActiveProfile({
        id: 'student-1',
        person: { id: 'person-1', name: 'Ali Hassan' },
      }),
    ]
    mockBillingAssignmentFindFirst.mockResolvedValue(
      makeSubscriptionAssignment()
    )
    mockProgramProfileFindMany.mockResolvedValue(profiles)
    mockStripe.subscriptions.cancel.mockRejectedValue(
      new Error('Stripe API error')
    )

    const result = await withdrawFamily(baseInput)

    expect(result.withdrawnCount).toBe(1)
    expect(result.billingCanceled).toBe(false)
    expect(result.billingError).toBe('Stripe API error')
    expect(logError).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Error),
      expect.stringContaining('Billing cancellation failed'),
      expect.objectContaining({ familyReferenceId: 'family-1' })
    )
  })

  it('should deactivate all billing assignments in the transaction', async () => {
    const profiles = [
      makeActiveProfile({
        id: 'student-1',
        person: { id: 'person-1', name: 'Ali Hassan' },
      }),
      makeActiveProfile({
        id: 'student-2',
        person: { id: 'person-2', name: 'Fatima Hassan' },
      }),
    ]
    mockBillingAssignmentFindFirst.mockResolvedValue(null)
    mockProgramProfileFindMany.mockResolvedValue(profiles)

    await withdrawFamily(baseInput)

    expect(mockBillingAssignmentUpdateManyTx).toHaveBeenCalledTimes(1)
    expect(mockBillingAssignmentUpdateManyTx).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          programProfile: {
            familyReferenceId: 'family-1',
            program: 'DUGSI_PROGRAM',
          },
        },
        data: expect.objectContaining({ isActive: false }),
      })
    )
  })
})
