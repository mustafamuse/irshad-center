import { beforeEach, describe, expect, it, vi } from 'vitest'

import { updateDugsiSubscriptionPricing } from '../subscription-pricing'

const { mockRetrieve, mockUpdate } = vi.hoisted(() => ({
  mockRetrieve: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/keys/stripe', () => ({
  getDugsiKeys: () => ({ productId: 'prod_test' }),
}))

const stripe = {
  subscriptions: { retrieve: mockRetrieve, update: mockUpdate },
} as never

const ROSTER = [
  { id: 'p1', name: 'Aisha' },
  { id: 'p2', name: 'Omar' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockRetrieve.mockResolvedValue({
    cancel_at_period_end: false,
    items: { data: [{ id: 'si_1' }] },
  })
  mockUpdate.mockResolvedValue({})
})

describe('updateDugsiSubscriptionPricing', () => {
  it('updates price and full metadata block', async () => {
    await updateDugsiSubscriptionPricing(stripe, 'sub_1', 16000, ROSTER)
    expect(mockUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        proration_behavior: 'none',
        items: [
          expect.objectContaining({
            id: 'si_1',
            price_data: expect.objectContaining({
              product: 'prod_test',
              unit_amount: 16000,
              currency: 'usd',
            }),
          }),
        ],
        metadata: expect.objectContaining({
          Children: 'Aisha, Omar',
          childCount: '2',
          calculatedRate: '16000',
          profileIds: 'p1,p2',
        }),
      })
    )
  })

  it('does not touch cancel_at_period_end by default', async () => {
    mockRetrieve.mockResolvedValueOnce({
      cancel_at_period_end: true,
      items: { data: [{ id: 'si_1' }] },
    })
    await updateDugsiSubscriptionPricing(stripe, 'sub_1', 16000, ROSTER)
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty(
      'cancel_at_period_end'
    )
  })

  it('clears cancel_at_period_end when asked and set', async () => {
    mockRetrieve.mockResolvedValueOnce({
      cancel_at_period_end: true,
      items: { data: [{ id: 'si_1' }] },
    })
    await updateDugsiSubscriptionPricing(stripe, 'sub_1', 16000, ROSTER, {
      clearCancelAtPeriodEnd: true,
    })
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({
      cancel_at_period_end: false,
    })
  })

  it('omits cancel flag when asked but not set', async () => {
    await updateDugsiSubscriptionPricing(stripe, 'sub_1', 16000, ROSTER, {
      clearCancelAtPeriodEnd: true,
    })
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty(
      'cancel_at_period_end'
    )
  })

  it('throws STRIPE_ERROR when subscription has no items', async () => {
    mockRetrieve.mockResolvedValueOnce({ items: { data: [] } })
    await expect(
      updateDugsiSubscriptionPricing(stripe, 'sub_1', 16000, ROSTER)
    ).rejects.toThrow('no line items')
  })
})
