import type Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockGetSubscriptionByStripeId, mockLoggerWarn } = vi.hoisted(() => ({
  mockGetSubscriptionByStripeId: vi.fn(),
  mockLoggerWarn: vi.fn(),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getBillingAccountByStripeCustomerId: vi.fn(),
  getSubscriptionByStripeId: mockGetSubscriptionByStripeId,
  getBillingAssignmentsBySubscription: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
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

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, cb: () => unknown) => cb()),
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/services/shared/billing-service', () => ({
  createOrUpdateBillingAccount: vi.fn(),
  linkSubscriptionToProfiles: vi.fn(),
  unlinkSubscription: vi.fn(),
}))

vi.mock('@/lib/services/shared/subscription-service', () => ({
  createSubscriptionFromStripe: vi.fn(),
}))

vi.mock('@/lib/utils/dugsi-tuition', () => ({
  calculateDugsiRate: vi.fn(),
}))

vi.mock('@/lib/utils/mahad-tuition', () => ({
  calculateMahadRate: vi.fn(),
}))

vi.mock('@/lib/utils/type-guards', () => ({
  extractCustomerId: vi.fn(),
  extractPeriodDates: vi.fn(() => ({
    periodStart: new Date(),
    periodEnd: new Date(),
  })),
  isValidSubscriptionStatus: vi.fn(() => true),
}))

import { handleSubscriptionUpdated } from '../webhook-service'

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

describe('handleSubscriptionUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns early with warning when subscription not found in database', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue(null)

    const subscription = createMockSubscription({ id: 'sub_legacy_123' })
    const result = await handleSubscriptionUpdated(subscription)

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
