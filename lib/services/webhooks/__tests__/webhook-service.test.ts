import type Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetSubscriptionByStripeId,
  mockGetBillingAccountByStripeCustomerId,
  mockGetPersonById,
  mockFindPersonByBillingCustomerId,
  mockCreateOrUpdateBillingAccount,
  mockLinkSubscriptionToProfiles,
  mockCreateSubscriptionFromStripe,
  mockCaptureMessage,
  mockExtractCustomerId,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockGetSubscriptionByStripeId: vi.fn(),
  mockGetBillingAccountByStripeCustomerId: vi.fn(),
  mockGetPersonById: vi.fn(),
  mockFindPersonByBillingCustomerId: vi.fn(),
  mockCreateOrUpdateBillingAccount: vi.fn(),
  mockLinkSubscriptionToProfiles: vi.fn(),
  mockCreateSubscriptionFromStripe: vi.fn(),
  mockCaptureMessage: vi.fn(),
  mockExtractCustomerId: vi.fn(),
  mockLoggerWarn: vi.fn(),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getBillingAccountByStripeCustomerId: mockGetBillingAccountByStripeCustomerId,
  getSubscriptionByStripeId: mockGetSubscriptionByStripeId,
  getBillingAssignmentsBySubscription: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
}))

vi.mock('@/lib/db/queries/person', () => ({
  getPersonById: mockGetPersonById,
  findPersonByBillingCustomerId: mockFindPersonByBillingCustomerId,
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {},
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, cb: () => unknown) => cb()),
  captureMessage: mockCaptureMessage,
}))

vi.mock('@/lib/services/shared/billing-service', () => ({
  createOrUpdateBillingAccount: mockCreateOrUpdateBillingAccount,
  linkSubscriptionToProfiles: mockLinkSubscriptionToProfiles,
  unlinkSubscription: vi.fn(),
}))

vi.mock('@/lib/services/shared/subscription-service', () => ({
  createSubscriptionFromStripe: mockCreateSubscriptionFromStripe,
}))

vi.mock('@/lib/utils/dugsi-tuition', () => ({
  calculateDugsiRate: vi.fn(),
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

import { updateSubscriptionStatus } from '@/lib/db/queries/billing'

import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
} from '../webhook-service'

function createMockSubscription(
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  return {
    id: 'sub_test_123',
    object: 'subscription',
    status: 'active',
    customer: 'cus_test_123',
    items: { object: 'list', data: [], has_more: false, url: '' },
    ...overrides,
  } as Stripe.Subscription
}

describe('handleSubscriptionCreated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractCustomerId.mockReturnValue('cus_test_123')
    mockGetSubscriptionByStripeId.mockResolvedValue(null)
    mockGetBillingAccountByStripeCustomerId.mockResolvedValue(null)
    mockGetPersonById.mockResolvedValue(null)
    mockFindPersonByBillingCustomerId.mockResolvedValue(null)
    mockCreateOrUpdateBillingAccount.mockResolvedValue({ id: 'ba_1' })
    mockCreateSubscriptionFromStripe.mockResolvedValue({
      id: 'db_sub_1',
      status: 'active',
    })
  })

  it('skips creation when the subscription already exists', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue({
      id: 'db_sub_1',
      status: 'active',
    })

    const result = await handleSubscriptionCreated(
      createMockSubscription(),
      'DUGSI'
    )

    expect(result).toEqual({
      subscriptionId: 'db_sub_1',
      status: 'active',
      created: false,
    })
    expect(mockCreateOrUpdateBillingAccount).not.toHaveBeenCalled()
    expect(mockCreateSubscriptionFromStripe).not.toHaveBeenCalled()
  })

  it('still links profiles when the subscription row already exists', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue({
      id: 'db_sub_1',
      status: 'active',
    })

    const subscription = createMockSubscription({
      items: {
        object: 'list',
        data: [{ price: { unit_amount: 15000 } }],
        has_more: false,
        url: '',
      } as unknown as Stripe.Subscription['items'],
    })

    const result = await handleSubscriptionCreated(subscription, 'DUGSI', [
      'profile_1',
    ])

    expect(mockCreateSubscriptionFromStripe).not.toHaveBeenCalled()
    expect(mockLinkSubscriptionToProfiles).toHaveBeenCalledWith(
      'db_sub_1',
      ['profile_1'],
      15000,
      'Linked automatically via webhook'
    )
    expect(result.created).toBe(false)
  })

  it('fails soft with a manual-linking Sentry alert when no person resolves', async () => {
    const result = await handleSubscriptionCreated(
      createMockSubscription({ metadata: { source: 'dugsi-payment-link' } }),
      'DUGSI'
    )

    expect(result).toEqual({
      subscriptionId: 'sub_test_123',
      status: 'active',
      created: false,
    })
    expect(mockCreateOrUpdateBillingAccount).not.toHaveBeenCalled()
    expect(mockCreateSubscriptionFromStripe).not.toHaveBeenCalled()
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'Subscription could not be matched to person',
      expect.objectContaining({
        level: 'error',
        extra: expect.objectContaining({
          subscriptionId: 'sub_test_123',
          customerId: 'cus_test_123',
          accountType: 'DUGSI',
          metadataSource: 'dugsi-payment-link',
          action: 'manual_linking_required',
        }),
      })
    )
  })

  it('does not trust a metadata person ID that is missing from the database', async () => {
    const subscription = createMockSubscription({
      metadata: { guardianPersonId: 'person_bogus' },
    })

    const result = await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(result.created).toBe(false)
    expect(mockCreateOrUpdateBillingAccount).not.toHaveBeenCalled()
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'Subscription metadata references unknown person',
      expect.objectContaining({ level: 'warning' })
    )
  })

  it('falls back to the billing-customer lookup when metadata person is bogus', async () => {
    mockFindPersonByBillingCustomerId.mockResolvedValue({ id: 'person_real' })

    const subscription = createMockSubscription({
      metadata: { guardianPersonId: 'person_bogus' },
    })

    await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockFindPersonByBillingCustomerId).toHaveBeenCalledWith(
      'cus_test_123',
      'DUGSI'
    )
    expect(mockCreateOrUpdateBillingAccount).toHaveBeenCalledWith({
      personId: 'person_real',
      accountType: 'DUGSI',
      stripeCustomerId: 'cus_test_123',
    })
    expect(mockCreateSubscriptionFromStripe).toHaveBeenCalled()
  })

  it('creates a billing account from a DB-verified metadata person ID', async () => {
    mockGetPersonById.mockResolvedValue({ id: 'person_meta' })

    const subscription = createMockSubscription({
      metadata: { guardianPersonId: 'person_meta' },
    })

    const result = await handleSubscriptionCreated(subscription, 'DUGSI')

    expect(mockGetPersonById).toHaveBeenCalledWith('person_meta')
    expect(mockCreateOrUpdateBillingAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: 'person_meta',
        accountType: 'DUGSI',
        stripeCustomerId: 'cus_test_123',
        paymentMethodCaptured: true,
      })
    )
    expect(result.created).toBe(true)
    expect(mockCaptureMessage).not.toHaveBeenCalled()
  })
})

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

  it('persists paused when pause_collection is set on an active subscription', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue({ id: 'db_sub_1' })

    const subscription = createMockSubscription({
      status: 'active',
      pause_collection: { behavior: 'mark_uncollectible', resumes_at: null },
    })
    const result = await handleSubscriptionUpdated(subscription, 'DUGSI')

    expect(result.status).toBe('paused')
    expect(vi.mocked(updateSubscriptionStatus)).toHaveBeenCalledWith(
      'db_sub_1',
      'paused',
      expect.any(Object)
    )
  })

  it('persists active when pause_collection is cleared', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue({ id: 'db_sub_1' })

    const subscription = createMockSubscription({
      status: 'active',
      pause_collection: null,
    })
    const result = await handleSubscriptionUpdated(subscription, 'DUGSI')

    expect(result.status).toBe('active')
    expect(vi.mocked(updateSubscriptionStatus)).toHaveBeenCalledWith(
      'db_sub_1',
      'active',
      expect.any(Object)
    )
  })

  it('does not map paused for Mahad even when pause_collection is set', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue({ id: 'db_sub_1' })

    const subscription = createMockSubscription({
      status: 'active',
      pause_collection: { behavior: 'mark_uncollectible', resumes_at: null },
    })
    const result = await handleSubscriptionUpdated(subscription, 'MAHAD')

    expect(result.status).toBe('active')
    expect(vi.mocked(updateSubscriptionStatus)).toHaveBeenCalledWith(
      'db_sub_1',
      'active',
      expect.any(Object)
    )
  })

  it('does not mask non-active statuses when pause_collection is set', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue({ id: 'db_sub_1' })

    const subscription = createMockSubscription({
      status: 'past_due',
      pause_collection: { behavior: 'void', resumes_at: null },
    })
    const result = await handleSubscriptionUpdated(subscription, 'DUGSI')

    expect(result.status).toBe('past_due')
  })
})
