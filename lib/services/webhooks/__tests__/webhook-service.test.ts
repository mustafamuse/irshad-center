import Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetSubscriptionByStripeId,
  mockGetBillingAccountByStripeCustomerId,
  mockLoggerWarn,
  mockFindGuardianWithBillableDugsiChildren,
  mockVerifyDugsiProfileIdsForGuardian,
  mockFindBillableDugsiProfileIdsForGuardian,
  mockCustomersRetrieve,
  mockSubscriptionsUpdate,
  mockCreateOrUpdateBillingAccount,
  mockLinkSubscriptionToProfiles,
  mockCreateSubscriptionFromStripe,
  mockSentrycaptureMessage,
  mockSentrycaptureException,
  mockCalculateDugsiRate,
  mockExtractCustomerId,
  mockLogError,
  mockFindPersonByStripeCustomerId,
  mockFindPersonById,
} = vi.hoisted(() => ({
  mockGetSubscriptionByStripeId: vi.fn(),
  mockGetBillingAccountByStripeCustomerId: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockFindGuardianWithBillableDugsiChildren: vi.fn(),
  mockVerifyDugsiProfileIdsForGuardian: vi.fn(),
  mockFindBillableDugsiProfileIdsForGuardian: vi.fn(),
  mockCustomersRetrieve: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
  mockCreateOrUpdateBillingAccount: vi.fn(),
  mockLinkSubscriptionToProfiles: vi.fn(),
  mockCreateSubscriptionFromStripe: vi.fn(),
  mockSentrycaptureMessage: vi.fn(),
  mockSentrycaptureException: vi.fn(),
  mockCalculateDugsiRate: vi.fn(),
  mockExtractCustomerId: vi.fn(),
  mockLogError: vi.fn(),
  mockFindPersonByStripeCustomerId: vi.fn(),
  mockFindPersonById: vi.fn(),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getBillingAccountByStripeCustomerId: mockGetBillingAccountByStripeCustomerId,
  getSubscriptionByStripeId: mockGetSubscriptionByStripeId,
  getBillingAssignmentsBySubscription: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
}))

vi.mock('@/lib/db/queries/person', () => ({
  findPersonById: mockFindPersonById,
  findPersonByStripeCustomerId: mockFindPersonByStripeCustomerId,
}))

vi.mock('@/lib/db/queries/program-profile', () => ({}))

vi.mock('@/lib/db/queries/dugsi-profiles', () => ({
  findGuardianWithBillableDugsiChildren:
    mockFindGuardianWithBillableDugsiChildren,
  verifyDugsiProfileIdsForGuardian: mockVerifyDugsiProfileIdsForGuardian,
  findBillableDugsiProfileIdsForGuardian:
    mockFindBillableDugsiProfileIdsForGuardian,
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logError: mockLogError,
}))

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, cb: () => unknown) => cb()),
  captureMessage: mockSentrycaptureMessage,
  captureException: mockSentrycaptureException,
}))

vi.mock('@/lib/services/shared/billing-service', () => ({
  createOrUpdateBillingAccount: mockCreateOrUpdateBillingAccount,
  linkSubscriptionToProfiles: mockLinkSubscriptionToProfiles,
  unlinkSubscription: vi.fn(),
}))

vi.mock('@/lib/services/shared/subscription-service', () => ({
  createSubscriptionFromStripe: mockCreateSubscriptionFromStripe,
}))

vi.mock('@/lib/stripe-dugsi', () => ({
  getDugsiStripeClient: vi.fn(() => ({
    customers: { retrieve: mockCustomersRetrieve },
    subscriptions: { update: mockSubscriptionsUpdate },
  })),
}))

vi.mock('@/lib/utils/dugsi-tuition', () => ({
  calculateDugsiRate: mockCalculateDugsiRate,
}))

vi.mock('@/lib/utils/mahad-tuition', () => ({
  calculateMahadRate: vi.fn(),
}))

vi.mock('@/lib/utils/type-guards', () => ({
  extractCustomerId: mockExtractCustomerId,
  extractPeriodDates: vi.fn(() => ({
    periodStart: new Date(),
    periodEnd: new Date(),
  })),
  isValidSubscriptionStatus: vi.fn(() => true),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import {
  handleSubscriptionUpdated,
  handleSubscriptionCreated,
} from '../webhook-service'

function createMockSubscription(
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  return {
    id: 'sub_test_123',
    object: 'subscription',
    status: 'active',
    customer: 'cus_test_123',
    metadata: {},
    created: 1700000000,
    items: {
      object: 'list',
      data: [
        {
          price: { unit_amount: 5000 },
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '',
    },
    ...overrides,
  } as Stripe.Subscription
}

describe('handleSubscriptionUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns early with warning when subscription not found in database', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue(null)

    const subscription = createMockSubscription({ id: 'sub_legacy_123' })
    const result = await handleSubscriptionUpdated(subscription, 'MAHAD')

    expect(result).toEqual({
      subscriptionId: '',
      status: 'active',
      created: false,
    })

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      { stripeSubscriptionId: 'sub_legacy_123' },
      'Subscription not found in database - student may need to re-register'
    )
  })
})

describe('handleSubscriptionCreated — Path 4 (Dugsi customer email fallback)', () => {
  const CUSTOMER_ID = 'cus_UHVIVIKqO7UuK6'
  const GUARDIAN_ID = 'guardian-person-id'
  const PROFILE_ID_1 = 'profile-id-1'
  const PROFILE_ID_2 = 'profile-id-2'
  const FAMILY_ID = 'family-ref-id'
  const BILLING_ACCOUNT_ID = 'billing-account-id'
  const DB_SUBSCRIPTION_ID = 'db-sub-id'
  const STANDARD_RATE = 6000

  const mockGuardianPerson = {
    id: GUARDIAN_ID,
    name: 'Kadar Warfa',
    email: 'khadra.warfa@gmail.com',
    phone: '6124420703',
    programProfiles: [],
  }

  const mockFamilyProfiles = [
    { id: PROFILE_ID_1, familyReferenceId: FAMILY_ID },
    { id: PROFILE_ID_2, familyReferenceId: FAMILY_ID },
  ]

  const mockGuardianWithChildren = {
    ...mockGuardianPerson,
    guardianRelationships: [
      { dependent: { programProfiles: [mockFamilyProfiles[0]] } },
      { dependent: { programProfiles: [mockFamilyProfiles[1]] } },
    ],
  }

  const mockBillingAccount = {
    id: BILLING_ACCOUNT_ID,
    personId: GUARDIAN_ID,
  }

  const mockDbSubscription = {
    id: DB_SUBSCRIPTION_ID,
    status: 'active',
    stripeSubscriptionId: 'sub_test_123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractCustomerId.mockReturnValue(CUSTOMER_ID)
    mockGetBillingAccountByStripeCustomerId.mockResolvedValue(null)
    mockFindPersonById.mockResolvedValue(null)
    // Path 3: no existing person linked to this customer ID
    mockFindPersonByStripeCustomerId.mockResolvedValue(null)
    // Path 4: guardian found by email with billable children
    mockFindGuardianWithBillableDugsiChildren.mockResolvedValue(
      mockGuardianWithChildren
    )
    mockCustomersRetrieve.mockResolvedValue({
      id: CUSTOMER_ID,
      deleted: false,
      email: 'khadra.warfa@gmail.com',
    })
    mockCreateOrUpdateBillingAccount.mockResolvedValue(mockBillingAccount)
    mockCreateSubscriptionFromStripe.mockResolvedValue(mockDbSubscription)
    mockCalculateDugsiRate.mockReturnValue(STANDARD_RATE)
    mockSubscriptionsUpdate.mockResolvedValue({})
  })

  it('resolves billing account via Stripe customer email and derives profile IDs', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    const result = await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockCustomersRetrieve).toHaveBeenCalledWith(CUSTOMER_ID)
    expect(mockFindGuardianWithBillableDugsiChildren).toHaveBeenCalledWith(
      'khadra.warfa@gmail.com'
    )
    expect(mockCreateOrUpdateBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: GUARDIAN_ID,
        accountType: 'DUGSI',
        stripeCustomerId: CUSTOMER_ID,
        paymentMethodCaptured: true,
      })
    )
    expect(result.created).toBe(true)
    expect(result.subscriptionId).toBe(DB_SUBSCRIPTION_ID)
  })

  it('uses subscription.created timestamp for paymentMethodCapturedAt in fallback', async () => {
    const STRIPE_CREATED_TS = 1700000000
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
      created: STRIPE_CREATED_TS,
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockCreateOrUpdateBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethodCapturedAt: new Date(STRIPE_CREATED_TS * 1000),
      })
    )
  })

  it('patches Stripe subscription metadata with calculated rate and override flag', async () => {
    const actualAmount = 4500
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
      items: {
        object: 'list',
        data: [
          { price: { unit_amount: actualAmount } } as Stripe.SubscriptionItem,
        ],
        has_more: false,
        url: '',
      },
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      'sub_test_123',
      expect.objectContaining({
        metadata: expect.objectContaining({
          guardianPersonId: GUARDIAN_ID,
          familyId: FAMILY_ID,
          childCount: '2',
          profileIds: `${PROFILE_ID_1},${PROFILE_ID_2}`,
          calculatedRate: String(STANDARD_RATE),
          overrideUsed: 'true',
          source: 'dugsi-webhook-fallback-recovery',
        }),
      })
    )
  })

  it('patches metadata before linking profiles so Stripe is updated even if link step throws', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    const callOrder: string[] = []
    mockCreateSubscriptionFromStripe.mockImplementation(async () => {
      callOrder.push('createSubscription')
      return mockDbSubscription
    })
    mockLinkSubscriptionToProfiles.mockImplementation(async () => {
      callOrder.push('linkProfiles')
    })
    mockSubscriptionsUpdate.mockImplementation(async () => {
      callOrder.push('patchMetadata')
      return {}
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(callOrder).toEqual([
      'createSubscription',
      'patchMetadata',
      'linkProfiles',
    ])
  })

  it('sets overrideUsed to false when actual amount matches standard rate', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
      items: {
        object: 'list',
        data: [
          { price: { unit_amount: STANDARD_RATE } } as Stripe.SubscriptionItem,
        ],
        has_more: false,
        url: '',
      },
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      'sub_test_123',
      expect.objectContaining({
        metadata: expect.objectContaining({ overrideUsed: 'false' }),
      })
    )
  })

  it('emits Sentry warning and logger.warn on successful fallback resolution', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockSentrycaptureMessage).toHaveBeenCalledWith(
      'Path 4: billing account and subscription record created via email fallback — linking profiles',
      expect.objectContaining({ level: 'info' })
    )
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ guardianPersonId: GUARDIAN_ID, childCount: 2 }),
      'Subscription created without metadata — resolved via Stripe customer email fallback'
    )
  })

  it('still succeeds and fires captureException when non-transient error occurs during metadata patch', async () => {
    mockSubscriptionsUpdate.mockRejectedValue(new Error('unexpected failure'))

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    const result = await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(result.created).toBe(true)
    expect(mockCreateOrUpdateBillingAccount).toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalled()
    expect(mockSentrycaptureException).toHaveBeenCalledOnce()
  })

  it('still succeeds and skips captureException when transient Stripe error occurs during metadata patch', async () => {
    const connectionError = new Stripe.errors.StripeConnectionError({
      message: 'Connection timeout',
      type: 'api_error',
    })
    mockSubscriptionsUpdate.mockRejectedValue(connectionError)

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    const result = await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(result.created).toBe(true)
    expect(mockLogError).toHaveBeenCalled()
    expect(mockSentrycaptureException).not.toHaveBeenCalled()
  })

  it('still succeeds when Stripe auth error occurs during metadata patch', async () => {
    const authError = new Stripe.errors.StripeAuthenticationError({
      message: 'No such API key',
      type: 'api_error',
    })
    mockSubscriptionsUpdate.mockRejectedValue(authError)

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    const result = await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(result.created).toBe(true)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.anything(),
      authError,
      'Path 4 fallback: Failed to patch Stripe subscription metadata — manual update required',
      expect.any(Object)
    )
    expect(mockSentrycaptureException).toHaveBeenCalledOnce()
  })

  it('includes familyName in Stripe metadata patch', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      'sub_test_123',
      expect.objectContaining({
        metadata: expect.objectContaining({
          familyName: mockGuardianPerson.name,
        }),
      })
    )
  })

  it('links derived profile IDs to the created subscription', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockLinkSubscriptionToProfiles).toHaveBeenCalledWith(
      DB_SUBSCRIPTION_ID,
      [PROFILE_ID_1, PROFILE_ID_2],
      5000,
      'Linked automatically via webhook'
    )
  })

  it('throws and logs when customers.retrieve rejects (Stripe API error)', async () => {
    const apiError = new Error('Stripe network timeout')
    mockCustomersRetrieve.mockRejectedValue(apiError)

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await expect(
      handleSubscriptionCreated(subscription, 'DUGSI')
    ).rejects.toThrow('Stripe network timeout')
    expect(mockLogError).toHaveBeenCalled()
    expect(mockFindGuardianWithBillableDugsiChildren).not.toHaveBeenCalled()
  })

  it('throws when Stripe customer is deleted and does not call guardian lookup', async () => {
    mockCustomersRetrieve.mockResolvedValue({ id: CUSTOMER_ID, deleted: true })

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await expect(
      handleSubscriptionCreated(subscription, 'DUGSI')
    ).rejects.toThrow(`No person found for customer ${CUSTOMER_ID}`)
    expect(mockFindGuardianWithBillableDugsiChildren).not.toHaveBeenCalled()
  })

  it('throws when Stripe customer has no email (not deleted)', async () => {
    mockCustomersRetrieve.mockResolvedValue({
      id: CUSTOMER_ID,
      deleted: false,
      email: null,
    })

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await expect(
      handleSubscriptionCreated(subscription, 'DUGSI')
    ).rejects.toThrow(`No person found for customer ${CUSTOMER_ID}`)
    expect(mockFindGuardianWithBillableDugsiChildren).not.toHaveBeenCalled()
  })

  it('throws when guardian lookup by email returns null', async () => {
    mockFindGuardianWithBillableDugsiChildren.mockResolvedValue(null)

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await expect(
      handleSubscriptionCreated(subscription, 'DUGSI')
    ).rejects.toThrow(`No person found for customer ${CUSTOMER_ID}`)
    expect(mockCreateOrUpdateBillingAccount).not.toHaveBeenCalled()
  })

  it('throws when guardian has no active Dugsi children', async () => {
    const guardianNoChildren = {
      ...mockGuardianPerson,
      guardianRelationships: [],
    }
    mockFindGuardianWithBillableDugsiChildren.mockResolvedValue(
      guardianNoChildren
    )

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await expect(
      handleSubscriptionCreated(subscription, 'DUGSI')
    ).rejects.toThrow(`No person found for customer ${CUSTOMER_ID}`)
    expect(mockCreateOrUpdateBillingAccount).not.toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ guardianPersonId: GUARDIAN_ID }),
      'Path 4 fallback: Cannot create billing account — guardian has no enrolled Dugsi children'
    )
  })

  it('throws without attempting fallback for non-DUGSI account type', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await expect(
      handleSubscriptionCreated(subscription, 'MAHAD')
    ).rejects.toThrow(`No person found for customer ${CUSTOMER_ID}`)
    expect(mockCustomersRetrieve).not.toHaveBeenCalled()
  })

  it('deduplicates profile IDs when guardian has multiple active roles for the same child', async () => {
    const DUPLICATE_PROFILE_ID = 'profile-id-shared'
    const guardianWithDuplicateRoles = {
      ...mockGuardianPerson,
      guardianRelationships: [
        {
          dependent: {
            programProfiles: [
              { id: DUPLICATE_PROFILE_ID, familyReferenceId: FAMILY_ID },
            ],
          },
        },
        {
          dependent: {
            programProfiles: [
              { id: DUPLICATE_PROFILE_ID, familyReferenceId: FAMILY_ID },
            ],
          },
        },
      ],
    }
    mockFindGuardianWithBillableDugsiChildren.mockResolvedValue(
      guardianWithDuplicateRoles
    )

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockCalculateDugsiRate).toHaveBeenCalledWith(1)
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      'sub_test_123',
      expect.objectContaining({
        metadata: expect.objectContaining({
          childCount: '1',
          profileIds: DUPLICATE_PROFILE_ID,
        }),
      })
    )
  })

  it('omits familyId from Stripe metadata when familyReferenceId is null', async () => {
    const guardianWithNullFamily = {
      ...mockGuardianPerson,
      guardianRelationships: [
        {
          dependent: {
            programProfiles: [{ id: PROFILE_ID_1, familyReferenceId: null }],
          },
        },
      ],
    }
    mockFindGuardianWithBillableDugsiChildren.mockResolvedValue(
      guardianWithNullFamily
    )

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    const metadataArg = mockSubscriptionsUpdate.mock.calls[0][1].metadata
    expect(metadataArg).not.toHaveProperty('familyId')
  })

  it('on retry via Path 1 does not re-patch Stripe metadata or look up guardian again', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    // First delivery: Path 4 runs (no billing account yet)
    await handleSubscriptionCreated(subscription, 'DUGSI')
    expect(mockSubscriptionsUpdate).toHaveBeenCalledOnce()
    expect(mockFindGuardianWithBillableDugsiChildren).toHaveBeenCalledOnce()

    vi.clearAllMocks()
    mockExtractCustomerId.mockReturnValue(CUSTOMER_ID)
    mockCreateSubscriptionFromStripe.mockResolvedValue(mockDbSubscription)
    mockCalculateDugsiRate.mockReturnValue(STANDARD_RATE)
    mockFindBillableDugsiProfileIdsForGuardian.mockResolvedValue([
      PROFILE_ID_1,
      PROFILE_ID_2,
    ])
    mockVerifyDugsiProfileIdsForGuardian.mockResolvedValue([])
    // Retry: billing account now exists → Path 1
    mockGetBillingAccountByStripeCustomerId.mockResolvedValue(
      mockBillingAccount
    )

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockCustomersRetrieve).not.toHaveBeenCalled()
    expect(mockFindGuardianWithBillableDugsiChildren).not.toHaveBeenCalled()
    expect(mockSubscriptionsUpdate).not.toHaveBeenCalled()
  })

  it('Stripe metadata is patched before linkProfilesIfPresent when link step throws', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
      items: {
        object: 'list',
        data: [{ price: { unit_amount: 0 } } as Stripe.SubscriptionItem],
        has_more: false,
        url: '',
      },
    })

    await expect(
      handleSubscriptionCreated(subscription, 'DUGSI')
    ).rejects.toThrow('Subscription has invalid amount')

    expect(mockSubscriptionsUpdate).toHaveBeenCalledOnce()
  })

  it('warns when guardian spans multiple families and uses first family ID', async () => {
    const FAMILY_ID_2 = 'family-ref-id-2'
    const guardianMultiFamily = {
      ...mockGuardianPerson,
      guardianRelationships: [
        {
          dependent: {
            programProfiles: [
              { id: PROFILE_ID_1, familyReferenceId: FAMILY_ID },
            ],
          },
        },
        {
          dependent: {
            programProfiles: [
              { id: PROFILE_ID_2, familyReferenceId: FAMILY_ID_2 },
            ],
          },
        },
      ],
    }
    mockFindGuardianWithBillableDugsiChildren.mockResolvedValue(
      guardianMultiFamily
    )

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        guardianPersonId: GUARDIAN_ID,
        familyIds: expect.arrayContaining([FAMILY_ID, FAMILY_ID_2]),
      }),
      'Path 4 fallback: guardian spans multiple families — using first family ID'
    )
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      'sub_test_123',
      expect.objectContaining({
        metadata: expect.objectContaining({ familyId: FAMILY_ID }),
      })
    )
  })
})

describe('handleSubscriptionCreated — Path 3 (existing billing account person)', () => {
  const CUSTOMER_ID = 'cus_existing_123'
  const EXISTING_PERSON_ID = 'existing-person-id'
  const BILLING_ACCOUNT_ID = 'billing-account-id'
  const DB_SUBSCRIPTION_ID = 'db-sub-id'

  const mockExistingPerson = {
    id: EXISTING_PERSON_ID,
    name: 'Existing Person',
    email: 'existing@example.com',
    phone: '6125550000',
  }

  const mockBillingAccount = {
    id: BILLING_ACCOUNT_ID,
    personId: EXISTING_PERSON_ID,
  }

  const mockDbSubscription = {
    id: DB_SUBSCRIPTION_ID,
    status: 'active',
    stripeSubscriptionId: 'sub_existing_123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractCustomerId.mockReturnValue(CUSTOMER_ID)
    mockGetBillingAccountByStripeCustomerId.mockResolvedValue(null)
    mockFindPersonById.mockResolvedValue(null)
    mockFindPersonByStripeCustomerId.mockResolvedValue(mockExistingPerson)
    mockCreateOrUpdateBillingAccount.mockResolvedValue(mockBillingAccount)
    mockCreateSubscriptionFromStripe.mockResolvedValue(mockDbSubscription)
    mockCalculateDugsiRate.mockReturnValue(5000)
    mockFindBillableDugsiProfileIdsForGuardian.mockResolvedValue([])
    mockVerifyDugsiProfileIdsForGuardian.mockResolvedValue([])
  })

  it('creates billing account for person found via existing billing account link', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    const result = await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockCreateOrUpdateBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: EXISTING_PERSON_ID,
        accountType: 'DUGSI',
        stripeCustomerId: CUSTOMER_ID,
      })
    )
    expect(mockCreateOrUpdateBillingAccount).not.toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethodCaptured: true })
    )
    expect(result.created).toBe(true)
    expect(mockCustomersRetrieve).not.toHaveBeenCalled()
  })
})

describe('handleSubscriptionCreated — Path 2 (subscription metadata personId)', () => {
  const CUSTOMER_ID = 'cus_path2_123'
  const PERSON_ID = 'person-id-from-metadata'
  const BILLING_ACCOUNT_ID = 'billing-account-id'
  const DB_SUBSCRIPTION_ID = 'db-sub-id'

  const mockBillingAccount = { id: BILLING_ACCOUNT_ID, personId: PERSON_ID }
  const mockDbSubscription = {
    id: DB_SUBSCRIPTION_ID,
    status: 'active',
    stripeSubscriptionId: 'sub_path2_123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractCustomerId.mockReturnValue(CUSTOMER_ID)
    mockGetBillingAccountByStripeCustomerId.mockResolvedValue(null)
    mockFindPersonById.mockResolvedValue({ id: PERSON_ID })
    mockCreateOrUpdateBillingAccount.mockResolvedValue(mockBillingAccount)
    mockCreateSubscriptionFromStripe.mockResolvedValue(mockDbSubscription)
    mockFindBillableDugsiProfileIdsForGuardian.mockResolvedValue([])
    mockVerifyDugsiProfileIdsForGuardian.mockResolvedValue([])
    mockCalculateDugsiRate.mockReturnValue(5000)
  })

  it('creates billing account from metadata.guardianPersonId', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: { guardianPersonId: PERSON_ID },
    })

    const result = await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockFindPersonById).toHaveBeenCalledWith(PERSON_ID)
    expect(mockCreateOrUpdateBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: PERSON_ID,
        accountType: 'DUGSI',
        stripeCustomerId: CUSTOMER_ID,
        paymentMethodCaptured: true,
      })
    )
    expect(result.created).toBe(true)
    expect(mockCustomersRetrieve).not.toHaveBeenCalled()
  })

  it('creates billing account from metadata.personId (Mahad-style key)', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: { personId: PERSON_ID },
    })

    const result = await handleSubscriptionCreated(subscription, 'MAHAD')

    expect(mockFindPersonById).toHaveBeenCalledWith(PERSON_ID)
    expect(mockCreateOrUpdateBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({ personId: PERSON_ID, accountType: 'MAHAD' })
    )
    expect(result.created).toBe(true)
  })

  it('falls through to Path 3 and throws when metadata personId not found in DB', async () => {
    mockFindPersonById.mockResolvedValue(null)
    mockFindPersonByStripeCustomerId.mockResolvedValue(null)

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: { guardianPersonId: 'nonexistent-person-id' },
    })

    await expect(
      handleSubscriptionCreated(subscription, 'MAHAD')
    ).rejects.toThrow(`No person found for customer ${CUSTOMER_ID}`)

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ metadataPersonId: 'nonexistent-person-id' }),
      'Path 2: metadataPersonId not found in DB — falling through to Path 3'
    )
    expect(mockCreateOrUpdateBillingAccount).not.toHaveBeenCalled()
  })
})

describe('handleSubscriptionCreated — Dugsi profile ID verification (Paths 1/2/3)', () => {
  const CUSTOMER_ID = 'cus_common_123'
  const GUARDIAN_ID = 'guardian-person-id'
  const PROFILE_ID_1 = 'profile-id-1'
  const PROFILE_ID_2 = 'profile-id-2'
  const BILLING_ACCOUNT_ID = 'billing-account-id'
  const DB_SUBSCRIPTION_ID = 'db-sub-id'

  const mockBillingAccount = {
    id: BILLING_ACCOUNT_ID,
    personId: GUARDIAN_ID,
  }

  const mockDbSubscription = {
    id: DB_SUBSCRIPTION_ID,
    status: 'active',
    stripeSubscriptionId: 'sub_common_123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractCustomerId.mockReturnValue(CUSTOMER_ID)
    // Path 1: billing account exists
    mockGetBillingAccountByStripeCustomerId.mockResolvedValue(
      mockBillingAccount
    )
    mockFindPersonById.mockResolvedValue(null)
    mockFindPersonByStripeCustomerId.mockResolvedValue(null)
    mockCreateOrUpdateBillingAccount.mockResolvedValue(mockBillingAccount)
    mockCreateSubscriptionFromStripe.mockResolvedValue(mockDbSubscription)
    mockCalculateDugsiRate.mockReturnValue(5000)
    mockVerifyDugsiProfileIdsForGuardian.mockResolvedValue([])
    mockFindBillableDugsiProfileIdsForGuardian.mockResolvedValue([
      PROFILE_ID_1,
      PROFILE_ID_2,
    ])
  })

  it('ignores unverified Dugsi profileIds from Stripe metadata and links DB-derived billable children', async () => {
    const FAKE_PROFILE_ID = 'fake-unverified-profile-id'
    // Verification rejects the fake ID
    mockVerifyDugsiProfileIdsForGuardian.mockResolvedValue([])

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: { profileIds: FAKE_PROFILE_ID },
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        metadataProfileIds: [FAKE_PROFILE_ID],
      }),
      'All Dugsi profileIds from Stripe metadata failed verification — falling back to DB derivation'
    )
    expect(mockLinkSubscriptionToProfiles).toHaveBeenCalledWith(
      DB_SUBSCRIPTION_ID,
      [PROFILE_ID_1, PROFILE_ID_2],
      5000,
      'Linked automatically via webhook'
    )
  })

  it('uses verified metadata profile IDs when they pass DB check', async () => {
    mockVerifyDugsiProfileIdsForGuardian.mockResolvedValue([PROFILE_ID_1])

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: { profileIds: PROFILE_ID_1 },
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockLinkSubscriptionToProfiles).toHaveBeenCalledWith(
      DB_SUBSCRIPTION_ID,
      [PROFILE_ID_1],
      5000,
      'Linked automatically via webhook'
    )
    expect(mockFindBillableDugsiProfileIdsForGuardian).not.toHaveBeenCalled()
  })

  it('falls back to full DB derivation when no metadata profile hints are present', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockVerifyDugsiProfileIdsForGuardian).not.toHaveBeenCalled()
    expect(mockFindBillableDugsiProfileIdsForGuardian).toHaveBeenCalledWith(
      GUARDIAN_ID
    )
    expect(mockLinkSubscriptionToProfiles).toHaveBeenCalledWith(
      DB_SUBSCRIPTION_ID,
      [PROFILE_ID_1, PROFILE_ID_2],
      5000,
      'Linked automatically via webhook'
    )
  })

  it('does not fire Dugsi metadata patch for common Dugsi paths', async () => {
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockSubscriptionsUpdate).not.toHaveBeenCalled()
    expect(mockSentrycaptureMessage).not.toHaveBeenCalled()
  })

  it('uses metadata profile ID hints without Dugsi DB lookup for Mahad subscriptions', async () => {
    const MAHAD_PROFILE_ID = 'mahad-profile-id'
    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: { profileId: MAHAD_PROFILE_ID },
    })

    await handleSubscriptionCreated(subscription, 'MAHAD')

    expect(mockVerifyDugsiProfileIdsForGuardian).not.toHaveBeenCalled()
    expect(mockFindBillableDugsiProfileIdsForGuardian).not.toHaveBeenCalled()
    expect(mockLinkSubscriptionToProfiles).toHaveBeenCalledWith(
      DB_SUBSCRIPTION_ID,
      [MAHAD_PROFILE_ID],
      5000,
      'Linked automatically via webhook'
    )
  })

  it('throws and logs when subscription amount is zero and profiles are present', async () => {
    mockFindBillableDugsiProfileIdsForGuardian.mockResolvedValue([PROFILE_ID_1])

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
      items: {
        object: 'list',
        data: [{ price: { unit_amount: 0 } } as Stripe.SubscriptionItem],
        has_more: false,
        url: '',
      },
    })

    await expect(
      handleSubscriptionCreated(subscription, 'DUGSI')
    ).rejects.toThrow('Subscription has invalid amount')
    expect(mockLogError).toHaveBeenCalled()
    expect(mockLinkSubscriptionToProfiles).not.toHaveBeenCalled()
  })
})
