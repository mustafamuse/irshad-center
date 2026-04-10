import { StripeAccountType } from '@prisma/client'
import type Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetSubscriptionByStripeId,
  mockCreateSubscription,
  mockExtractPeriodDates,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockGetSubscriptionByStripeId: vi.fn(),
  mockCreateSubscription: vi.fn(),
  mockExtractPeriodDates: vi.fn(),
  mockLoggerWarn: vi.fn(),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getSubscriptionByStripeId: mockGetSubscriptionByStripeId,
  createSubscription: mockCreateSubscription,
  updateSubscriptionStatus: vi.fn(),
}))

vi.mock('@/lib/db/query-builders', () => ({
  LIVE_SUBSCRIPTION_STATUSES: ['active', 'trialing'],
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

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, cb: () => unknown) => cb()),
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/utils/stripe-client', () => ({
  getStripeClient: vi.fn(),
}))

vi.mock('@/lib/utils/type-guards', () => ({
  extractPeriodDates: mockExtractPeriodDates,
}))

vi.mock('@/lib/errors/action-error', () => ({
  ActionError: class ActionError extends Error {},
  ERROR_CODES: {},
}))

import { createSubscriptionFromStripe } from '../subscription-service'

function createMockStripeSubscription(
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  return {
    id: 'sub_test_123',
    object: 'subscription',
    status: 'active',
    customer: 'cus_test_123',
    currency: 'usd',
    metadata: {},
    created: 1700000000,
    items: {
      object: 'list',
      data: [
        {
          price: {
            unit_amount: 5000,
            recurring: { interval: 'month' },
          },
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '',
    },
    ...overrides,
  } as Stripe.Subscription
}

describe('createSubscriptionFromStripe — idempotency', () => {
  const BILLING_ACCOUNT_ID = 'billing-account-id'
  const EXISTING_SUB = {
    id: 'db-sub-id',
    status: 'active',
    stripeSubscriptionId: 'sub_test_123',
    billingAccountId: BILLING_ACCOUNT_ID,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractPeriodDates.mockReturnValue({
      periodStart: new Date(),
      periodEnd: new Date(),
    })
  })

  it('returns the existing row without creating a new one on retry', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue(EXISTING_SUB)

    const subscription = createMockStripeSubscription()
    const result = await createSubscriptionFromStripe(
      subscription,
      BILLING_ACCOUNT_ID,
      StripeAccountType.DUGSI
    )

    expect(result).toBe(EXISTING_SUB)
    expect(mockCreateSubscription).not.toHaveBeenCalled()
  })

  it('calls createSubscription when no existing row is found', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue(null)
    const newRow = {
      id: 'new-db-sub',
      status: 'active',
      billingAccountId: BILLING_ACCOUNT_ID,
    }
    mockCreateSubscription.mockResolvedValue(newRow)

    const subscription = createMockStripeSubscription()
    const result = await createSubscriptionFromStripe(
      subscription,
      BILLING_ACCOUNT_ID,
      StripeAccountType.DUGSI
    )

    expect(mockCreateSubscription).toHaveBeenCalledOnce()
    expect(result).toBe(newRow)
  })

  it('warns when idempotency return has a different billing account than requested', async () => {
    const DIFFERENT_BILLING_ACCOUNT_ID = 'billing-account-from-path-3'
    mockGetSubscriptionByStripeId.mockResolvedValue(EXISTING_SUB)

    const subscription = createMockStripeSubscription()
    await createSubscriptionFromStripe(
      subscription,
      DIFFERENT_BILLING_ACCOUNT_ID,
      StripeAccountType.DUGSI
    )

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: 'sub_test_123',
        storedBillingAccountId: BILLING_ACCOUNT_ID,
        requestedBillingAccountId: DIFFERENT_BILLING_ACCOUNT_ID,
      }),
      'createSubscriptionFromStripe: idempotency return — billing account mismatch between retry invocations'
    )
    expect(mockCreateSubscription).not.toHaveBeenCalled()
  })

  it('does not warn when idempotency return has the same billing account', async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue(EXISTING_SUB)

    const subscription = createMockStripeSubscription()
    await createSubscriptionFromStripe(
      subscription,
      BILLING_ACCOUNT_ID,
      StripeAccountType.DUGSI
    )

    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })
})
