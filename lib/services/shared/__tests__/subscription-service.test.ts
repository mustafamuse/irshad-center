import type Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockCreateSubscription } = vi.hoisted(() => ({
  mockCreateSubscription: vi.fn(),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  createSubscription: (...args: unknown[]) => mockCreateSubscription(...args),
  getSubscriptionByStripeId: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: {} }))

vi.mock('@/lib/logger', () => {
  const stub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
  return { logger: stub, createServiceLogger: () => stub, logError: vi.fn() }
})

import { createSubscriptionFromStripe } from '../subscription-service'

const PERIOD_END = 1780000000

function makeStripeSubscription(
  status: Stripe.Subscription.Status
): Stripe.Subscription {
  return {
    id: 'sub_test_123',
    object: 'subscription',
    status,
    customer: 'cus_test_123',
    currency: 'usd',
    current_period_start: 1777000000,
    current_period_end: PERIOD_END,
    items: {
      object: 'list',
      data: [
        {
          price: { unit_amount: 16000, recurring: { interval: 'month' } },
        },
      ],
      has_more: false,
      url: '',
    },
  } as unknown as Stripe.Subscription
}

describe('createSubscriptionFromStripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSubscription.mockResolvedValue({ id: 'db_sub_1' })
  })

  it('sets paidUntil when Stripe reports the subscription active', async () => {
    await createSubscriptionFromStripe(
      makeStripeSubscription('active'),
      'ba_1',
      'DUGSI'
    )

    expect(mockCreateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ paidUntil: new Date(PERIOD_END * 1000) })
    )
  })

  it.each(['incomplete', 'past_due', 'unpaid', 'trialing'] as const)(
    'leaves paidUntil null for a %s subscription — nothing is settled yet',
    async (status) => {
      await createSubscriptionFromStripe(
        makeStripeSubscription(status),
        'ba_1',
        'MAHAD'
      )

      expect(mockCreateSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ paidUntil: null })
      )
    }
  )

  it('still records the billing schedule regardless of settlement', async () => {
    await createSubscriptionFromStripe(
      makeStripeSubscription('incomplete'),
      'ba_1',
      'DUGSI'
    )

    expect(mockCreateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPeriodEnd: new Date(PERIOD_END * 1000),
        amount: 16000,
      })
    )
  })
})
