import type Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetSubscriptionByStripeId,
  mockGetBillingAccountByStripeCustomerId,
  mockLoggerWarn,
  mockFindPersonByActiveContact,
  mockCustomersRetrieve,
  mockSubscriptionsUpdate,
  mockPrismaPersonFindFirst,
  mockCreateOrUpdateBillingAccount,
  mockLinkSubscriptionToProfiles,
  mockCreateSubscriptionFromStripe,
  mockSentrycaptureMessage,
  mockCalculateDugsiRate,
  mockExtractCustomerId,
  mockLogError,
} = vi.hoisted(() => ({
  mockGetSubscriptionByStripeId: vi.fn(),
  mockGetBillingAccountByStripeCustomerId: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockFindPersonByActiveContact: vi.fn(),
  mockCustomersRetrieve: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
  mockPrismaPersonFindFirst: vi.fn(),
  mockCreateOrUpdateBillingAccount: vi.fn(),
  mockLinkSubscriptionToProfiles: vi.fn(),
  mockCreateSubscriptionFromStripe: vi.fn(),
  mockSentrycaptureMessage: vi.fn(),
  mockCalculateDugsiRate: vi.fn(),
  mockExtractCustomerId: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getBillingAccountByStripeCustomerId: mockGetBillingAccountByStripeCustomerId,
  getSubscriptionByStripeId: mockGetSubscriptionByStripeId,
  getBillingAssignmentsBySubscription: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  findPersonByActiveContact: mockFindPersonByActiveContact,
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

vi.mock('@/lib/db', () => ({
  prisma: {
    person: { findFirst: mockPrismaPersonFindFirst },
  },
}))

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, cb: () => unknown) => cb()),
  captureMessage: mockSentrycaptureMessage,
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
    mockPrismaPersonFindFirst.mockReset()
    mockExtractCustomerId.mockReturnValue(CUSTOMER_ID)
    mockGetBillingAccountByStripeCustomerId.mockResolvedValue(null)
    mockPrismaPersonFindFirst
      .mockResolvedValueOnce(null) // Path 3: no existing billing account person
      .mockResolvedValueOnce(mockGuardianWithChildren) // Path 4: guardian with children
    mockCustomersRetrieve.mockResolvedValue({
      id: CUSTOMER_ID,
      deleted: false,
      email: 'khadra.warfa@gmail.com',
    })
    mockFindPersonByActiveContact.mockResolvedValue(mockGuardianPerson)
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
    expect(mockFindPersonByActiveContact).toHaveBeenCalledWith(
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

  it('patches Stripe subscription metadata with calculated rate and override flag', async () => {
    const actualAmount = 4500 // custom/override rate
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
      'Dugsi subscription resolved via customer email fallback',
      expect.objectContaining({ level: 'warning' })
    )
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ guardianPersonId: GUARDIAN_ID, childCount: 2 }),
      'Subscription created without metadata — resolved via Stripe customer email fallback'
    )
  })

  it('still succeeds when Stripe metadata update fails and emits Sentry error', async () => {
    mockSubscriptionsUpdate.mockRejectedValue(new Error('Stripe API timeout'))

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    const result = await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(result.created).toBe(true)
    expect(mockCreateOrUpdateBillingAccount).toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalled()
    expect(mockSentrycaptureMessage).toHaveBeenCalledWith(
      'Dugsi subscription metadata patch failed — manual intervention required',
      expect.objectContaining({ level: 'error' })
    )
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
    expect(mockFindPersonByActiveContact).not.toHaveBeenCalled()
  })

  it('throws when Stripe customer is deleted and does not call email lookup', async () => {
    mockCustomersRetrieve.mockResolvedValue({ id: CUSTOMER_ID, deleted: true })

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await expect(
      handleSubscriptionCreated(subscription, 'DUGSI')
    ).rejects.toThrow(`No person found for customer ${CUSTOMER_ID}`)
    expect(mockFindPersonByActiveContact).not.toHaveBeenCalled()
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
    expect(mockFindPersonByActiveContact).not.toHaveBeenCalled()
  })

  it('throws immediately when second person lookup returns null (concurrent deletion)', async () => {
    mockPrismaPersonFindFirst
      .mockReset()
      .mockResolvedValueOnce(null) // Path 3
      .mockResolvedValueOnce(null) // Path 4: guardianWithChildren lookup

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await expect(
      handleSubscriptionCreated(subscription, 'DUGSI')
    ).rejects.toThrow(`No person found for customer ${CUSTOMER_ID}`)
    expect(mockCreateOrUpdateBillingAccount).not.toHaveBeenCalled()
  })

  it('throws when email lookup finds no person in DB', async () => {
    mockFindPersonByActiveContact.mockResolvedValue(null)
    mockPrismaPersonFindFirst.mockReset().mockResolvedValue(null)

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await expect(
      handleSubscriptionCreated(subscription, 'DUGSI')
    ).rejects.toThrow(`No person found for customer ${CUSTOMER_ID}`)
  })

  it('throws when guardian has no active Dugsi children', async () => {
    const guardianNoChildren = {
      ...mockGuardianPerson,
      guardianRelationships: [],
    }
    mockPrismaPersonFindFirst
      .mockReset()
      .mockResolvedValueOnce(null) // Path 3
      .mockResolvedValueOnce(guardianNoChildren) // Path 4: guardian but no children

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
        // Same child appears via PARENT role and SPONSOR role
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
    mockPrismaPersonFindFirst
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(guardianWithDuplicateRoles)

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    // childCount should be 1 (not 2) and metadata should have deduplicated profileIds
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
    mockPrismaPersonFindFirst
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(guardianWithNullFamily)

    const subscription = createMockSubscription({
      customer: CUSTOMER_ID,
      metadata: {},
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    const metadataArg = mockSubscriptionsUpdate.mock.calls[0][1].metadata
    expect(metadataArg).not.toHaveProperty('familyId')
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
    mockPrismaPersonFindFirst
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(guardianMultiFamily)

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
    // First family ID wins
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
    mockPrismaPersonFindFirst.mockReset()
    mockExtractCustomerId.mockReturnValue(CUSTOMER_ID)
    mockGetBillingAccountByStripeCustomerId.mockResolvedValue(null)
    mockPrismaPersonFindFirst.mockResolvedValueOnce(mockExistingPerson)
    mockCreateOrUpdateBillingAccount.mockResolvedValue(mockBillingAccount)
    mockCreateSubscriptionFromStripe.mockResolvedValue(mockDbSubscription)
    mockCalculateDugsiRate.mockReturnValue(5000)
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
