/**
 * Subscription Service Tests
 *
 * Tests for subscription business logic.
 * Focus on validation, status checks, sync logic - not Stripe API calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { subscriptionFactory } from '../../utils/factories'
import {
  validateStripeSubscription,
  syncSubscriptionFromStripe,
  updateSubscriptionStatus,
  isSubscriptionActive,
  cancelSubscription,
  createSubscriptionFromStripe,
} from '@/lib/services/shared/subscription-service'

// Mock dependencies
vi.mock('@/lib/utils/stripe-client', () => ({
  getStripeClient: vi.fn(() => ({
    subscriptions: {
      retrieve: vi.fn(),
      cancel: vi.fn(),
    },
  })),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getSubscriptionByStripeId: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
}))

vi.mock('@/lib/utils/type-guards', () => ({
  extractPeriodDates: vi.fn((sub) => ({
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-02-01'),
  })),
}))

import { getStripeClient } from '@/lib/utils/stripe-client'
import {
  getSubscriptionByStripeId,
  createSubscription,
  updateSubscriptionStatus as updateSubscriptionStatusQuery,
} from '@/lib/db/queries/billing'

describe('SubscriptionService', () => {
  let mockStripe: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockStripe = {
      subscriptions: {
        retrieve: vi.fn(),
        cancel: vi.fn(),
      },
    }
    vi.mocked(getStripeClient).mockReturnValue(mockStripe)
  })

  describe('validateStripeSubscription - validation logic', () => {
    it('should throw error for invalid subscription ID format', async () => {
      await expect(
        validateStripeSubscription('invalid-id', 'MAHAD')
      ).rejects.toThrow('Invalid subscription ID format')
    })

    it('should accept valid subscription ID starting with sub_', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123456',
        customer: 'cus_123456',
        status: 'active',
        currency: 'usd',
        items: {
          data: [
            {
              price: {
                unit_amount: 15000,
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      })

      const result = await validateStripeSubscription('sub_123456', 'MAHAD')

      expect(result.subscriptionId).toBe('sub_123456')
    })

    it('should throw error if subscription not found in Stripe', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue(null)

      await expect(
        validateStripeSubscription('sub_123456', 'MAHAD')
      ).rejects.toThrow('Subscription not found in Stripe')
    })

    it('should extract customer ID from string', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123456',
        customer: 'cus_123456',
        status: 'active',
        currency: 'usd',
        items: {
          data: [
            {
              price: {
                unit_amount: 15000,
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      })

      const result = await validateStripeSubscription('sub_123456', 'MAHAD')

      expect(result.customerId).toBe('cus_123456')
    })

    it('should extract customer ID from object', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123456',
        customer: { id: 'cus_123456', name: 'John Doe' },
        status: 'active',
        currency: 'usd',
        items: {
          data: [
            {
              price: {
                unit_amount: 15000,
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      })

      const result = await validateStripeSubscription('sub_123456', 'MAHAD')

      expect(result.customerId).toBe('cus_123456')
    })

    it('should throw error if no customer ID in subscription', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123456',
        customer: null,
        status: 'active',
        currency: 'usd',
        items: { data: [] },
      })

      await expect(
        validateStripeSubscription('sub_123456', 'MAHAD')
      ).rejects.toThrow('Invalid customer ID in subscription')
    })

    it('should extract amount from price data', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123456',
        customer: 'cus_123456',
        status: 'active',
        currency: 'usd',
        items: {
          data: [
            {
              price: {
                unit_amount: 25000, // $250
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      })

      const result = await validateStripeSubscription('sub_123456', 'MAHAD')

      expect(result.amount).toBe(25000)
    })

    it('should default amount to 0 if no price data', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123456',
        customer: 'cus_123456',
        status: 'active',
        currency: 'usd',
        items: {
          data: [],
        },
      })

      const result = await validateStripeSubscription('sub_123456', 'MAHAD')

      expect(result.amount).toBe(0)
    })

    it('should extract currency and default to usd', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123456',
        customer: 'cus_123456',
        status: 'active',
        currency: 'eur',
        items: {
          data: [
            {
              price: {
                unit_amount: 15000,
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      })

      const result = await validateStripeSubscription('sub_123456', 'MAHAD')

      expect(result.currency).toBe('eur')
    })

    it('should extract interval and default to month', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123456',
        customer: 'cus_123456',
        status: 'active',
        currency: 'usd',
        items: {
          data: [
            {
              price: {
                unit_amount: 15000,
                recurring: { interval: 'year' },
              },
            },
          ],
        },
      })

      const result = await validateStripeSubscription('sub_123456', 'MAHAD')

      expect(result.interval).toBe('year')
    })
  })

  describe('syncSubscriptionFromStripe', () => {
    it('should throw error if subscription not in database', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123456',
        customer: 'cus_123456',
        status: 'active',
        currency: 'usd',
        items: { data: [{ price: { unit_amount: 15000 } }] },
      })
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(null)

      await expect(
        syncSubscriptionFromStripe('sub_123456', 'MAHAD')
      ).rejects.toThrow('Subscription not found in database')
    })

    it('should return updated:true when status changed', async () => {
      const dbSubscription = subscriptionFactory({ status: 'active' })

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123456',
        customer: 'cus_123456',
        status: 'past_due', // Different status
        currency: 'usd',
        items: { data: [{ price: { unit_amount: 15000 } }] },
      })
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(dbSubscription as any)
      vi.mocked(updateSubscriptionStatusQuery).mockResolvedValue({} as any)

      const result = await syncSubscriptionFromStripe('sub_123456', 'MAHAD')

      expect(result.updated).toBe(true)
      expect(result.status).toBe('past_due')
      expect(updateSubscriptionStatusQuery).toHaveBeenCalled()
    })

    it('should return updated:false when status unchanged', async () => {
      const dbSubscription = subscriptionFactory({ status: 'active' })

      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123456',
        customer: 'cus_123456',
        status: 'active', // Same status
        currency: 'usd',
        items: { data: [{ price: { unit_amount: 15000 } }] },
      })
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(dbSubscription as any)

      const result = await syncSubscriptionFromStripe('sub_123456', 'MAHAD')

      expect(result.updated).toBe(false)
      expect(result.status).toBe('active')
      expect(updateSubscriptionStatusQuery).not.toHaveBeenCalled()
    })
  })

  describe('isSubscriptionActive', () => {
    it('should return true for active subscription', async () => {
      const subscription = subscriptionFactory({ status: 'active' })
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(subscription as any)

      const result = await isSubscriptionActive('sub_123456')

      expect(result).toBe(true)
    })

    it('should return true for trialing subscription', async () => {
      const subscription = subscriptionFactory({ status: 'trialing' })
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(subscription as any)

      const result = await isSubscriptionActive('sub_123456')

      expect(result).toBe(true)
    })

    it('should return false for canceled subscription', async () => {
      const subscription = subscriptionFactory({ status: 'canceled' })
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(subscription as any)

      const result = await isSubscriptionActive('sub_123456')

      expect(result).toBe(false)
    })

    it('should return false for past_due subscription', async () => {
      const subscription = subscriptionFactory({ status: 'past_due' })
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(subscription as any)

      const result = await isSubscriptionActive('sub_123456')

      expect(result).toBe(false)
    })

    it('should return false for unpaid subscription', async () => {
      const subscription = subscriptionFactory({ status: 'unpaid' })
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(subscription as any)

      const result = await isSubscriptionActive('sub_123456')

      expect(result).toBe(false)
    })

    it('should return false if subscription not found', async () => {
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(null)

      const result = await isSubscriptionActive('sub_123456')

      expect(result).toBe(false)
    })
  })

  describe('updateSubscriptionStatus', () => {
    it('should throw error if subscription not found', async () => {
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(null)

      await expect(
        updateSubscriptionStatus('sub_123456', 'canceled')
      ).rejects.toThrow('Subscription not found in database')
    })

    it('should update status in database', async () => {
      const subscription = subscriptionFactory()
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(subscription as any)
      vi.mocked(updateSubscriptionStatusQuery).mockResolvedValue({} as any)

      await updateSubscriptionStatus('sub_123456', 'canceled')

      expect(updateSubscriptionStatusQuery).toHaveBeenCalledWith(
        subscription.id,
        'canceled',
        undefined
      )
    })

    it('should update with period data if provided', async () => {
      const subscription = subscriptionFactory()
      const periodData = {
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        paidUntil: new Date('2024-02-01'),
      }

      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(subscription as any)
      vi.mocked(updateSubscriptionStatusQuery).mockResolvedValue({} as any)

      await updateSubscriptionStatus('sub_123456', 'active', periodData)

      expect(updateSubscriptionStatusQuery).toHaveBeenCalledWith(
        subscription.id,
        'active',
        periodData
      )
    })
  })

  describe('cancelSubscription', () => {
    it('should update database status to canceled', async () => {
      const subscription = subscriptionFactory()
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(subscription as any)
      vi.mocked(updateSubscriptionStatusQuery).mockResolvedValue({} as any)

      const result = await cancelSubscription('sub_123456')

      expect(result.canceled).toBe(true)
      expect(result.canceledInStripe).toBe(false)
      expect(updateSubscriptionStatusQuery).toHaveBeenCalled()
    })

    it('should cancel in Stripe if requested', async () => {
      const subscription = subscriptionFactory()
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(subscription as any)
      vi.mocked(updateSubscriptionStatusQuery).mockResolvedValue({} as any)
      mockStripe.subscriptions.cancel.mockResolvedValue({})

      const result = await cancelSubscription('sub_123456', true, 'MAHAD')

      expect(result.canceledInStripe).toBe(true)
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123456')
    })

    it('should throw error if cancelInStripe is true but accountType not provided', async () => {
      const subscription = subscriptionFactory()
      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(subscription as any)
      vi.mocked(updateSubscriptionStatusQuery).mockResolvedValue({} as any)

      await expect(
        cancelSubscription('sub_123456', true)
      ).rejects.toThrow('Account type required when canceling in Stripe')
    })
  })

  describe('createSubscriptionFromStripe', () => {
    it('should extract customer ID and create subscription', async () => {
      const stripeSubscription = {
        id: 'sub_123456',
        customer: 'cus_123456',
        status: 'active',
        currency: 'usd',
        items: {
          data: [
            {
              price: {
                unit_amount: 15000,
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      }

      vi.mocked(createSubscription).mockResolvedValue({} as any)

      await createSubscriptionFromStripe(
        stripeSubscription as any,
        'billing-account-1',
        'MAHAD'
      )

      expect(createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          billingAccountId: 'billing-account-1',
          stripeAccountType: 'MAHAD',
          stripeSubscriptionId: 'sub_123456',
          stripeCustomerId: 'cus_123456',
          status: 'active',
          amount: 15000,
          currency: 'usd',
          interval: 'month',
        })
      )
    })

    it('should throw error if no customer ID', async () => {
      const stripeSubscription = {
        id: 'sub_123456',
        customer: null,
        status: 'active',
        currency: 'usd',
        items: { data: [] },
      }

      await expect(
        createSubscriptionFromStripe(
          stripeSubscription as any,
          'billing-account-1',
          'MAHAD'
        )
      ).rejects.toThrow('Invalid customer ID in subscription')
    })

    it('should handle missing price data gracefully', async () => {
      const stripeSubscription = {
        id: 'sub_123456',
        customer: 'cus_123456',
        status: 'active',
        currency: 'usd',
        items: { data: [] },
      }

      vi.mocked(createSubscription).mockResolvedValue({} as any)

      await createSubscriptionFromStripe(
        stripeSubscription as any,
        'billing-account-1',
        'MAHAD'
      )

      expect(createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 0,
          interval: 'month', // Default
        })
      )
    })
  })
})
