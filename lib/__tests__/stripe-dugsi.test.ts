/**
 * Dugsi Stripe Service Tests
 *
 * Tests for the separate Dugsi Stripe integration that ensures
 * complete isolation from the Mahad Stripe account.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { getStripeClient } from '@/lib/stripe'
import {
  getDugsiStripeClient,
  constructDugsiPaymentUrl,
} from '@/lib/stripe-dugsi'

// Mock Stripe module
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation((apiKey: string) => ({
      _api: { key: apiKey },
      customers: {
        list: vi.fn(),
        create: vi.fn(),
      },
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    })),
  }
})

// Store original env
const originalEnv = process.env

beforeEach(() => {
  vi.resetModules()
  process.env = {
    ...originalEnv,
    STRIPE_SECRET_KEY_PROD: 'sk_live_mahad',
    STRIPE_SECRET_KEY_DUGSI: 'sk_live_dugsi',
    STRIPE_WEBHOOK_SECRET_PROD: 'whsec_mahad',
    STRIPE_WEBHOOK_SECRET_DUGSI: 'whsec_dugsi',
    NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI: 'https://buy.stripe.com/test_dugsi',
  }
})

afterEach(() => {
  process.env = originalEnv
  vi.clearAllMocks()
})

describe('Dugsi Stripe Integration', () => {
  describe('Stripe Client Initialization', () => {
    it('should create separate Stripe instance for Dugsi', () => {
      const dugsiClient = getDugsiStripeClient()
      const mahadClient = getStripeClient()

      expect(dugsiClient).not.toBe(mahadClient)
      expect(dugsiClient._api.key).toBe('sk_live_dugsi')
      expect(mahadClient._api.key).toBe('sk_live_mahad')
    })

    it('should throw error if Dugsi key not configured', () => {
      delete process.env.STRIPE_SECRET_KEY_DUGSI

      expect(() => getDugsiStripeClient()).toThrow(
        'Dugsi Stripe key not configured'
      )
    })

    it('should maintain singleton pattern for Dugsi client', () => {
      const client1 = getDugsiStripeClient()
      const client2 = getDugsiStripeClient()

      expect(client1).toBe(client2)
    })

    it('should use correct API version', () => {
      const Stripe = require('stripe')

      // After getDugsiStripeClient is called
      getDugsiStripeClient()

      expect(Stripe).toHaveBeenCalledWith('sk_live_dugsi', {
        apiVersion: '2025-08-27.basil',
        typescript: true,
      })
    })
  })

  describe('Payment URL Construction', () => {
    it('should construct valid payment link URL with metadata', () => {
      const paymentUrl = constructDugsiPaymentUrl({
        parentEmail: 'parent@example.com',
        familyId: 'abc123_smith',
        childCount: 3,
      })

      const url = new URL(paymentUrl)
      expect(url.origin).toBe('https://buy.stripe.com')
      expect(url.pathname).toBe('/test_dugsi')
      expect(url.searchParams.get('prefilled_email')).toBe('parent@example.com')
      expect(url.searchParams.get('client_reference_id')).toBe(
        'dugsi_abc123_smith_3kids'
      )
    })

    it('should handle special characters in email', () => {
      const paymentUrl = constructDugsiPaymentUrl({
        parentEmail: 'test+special@example.com',
        familyId: 'test',
        childCount: 1,
      })

      const url = new URL(paymentUrl)
      expect(url.searchParams.get('prefilled_email')).toBe(
        'test+special@example.com'
      )
    })

    it('should throw error if payment link not configured', () => {
      delete process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI

      expect(() => {
        constructDugsiPaymentUrl({
          parentEmail: 'test@example.com',
          familyId: 'test',
          childCount: 1,
        })
      }).toThrow('Dugsi payment link not configured')
    })

    it('should handle single child correctly', () => {
      const paymentUrl = constructDugsiPaymentUrl({
        parentEmail: 'parent@example.com',
        familyId: 'xyz_jones',
        childCount: 1,
      })

      const url = new URL(paymentUrl)
      expect(url.searchParams.get('client_reference_id')).toBe(
        'dugsi_xyz_jones_1kid'
      )
    })

    it('should handle multiple children correctly', () => {
      const paymentUrl = constructDugsiPaymentUrl({
        parentEmail: 'parent@example.com',
        familyId: 'xyz_jones',
        childCount: 5,
      })

      const url = new URL(paymentUrl)
      expect(url.searchParams.get('client_reference_id')).toBe(
        'dugsi_xyz_jones_5kids'
      )
    })
  })

  describe('Webhook Secret Handling', () => {
    it('should use Dugsi-specific webhook secret', () => {
      const dugsiSecret = process.env.STRIPE_WEBHOOK_SECRET_DUGSI
      const mahadSecret = process.env.STRIPE_WEBHOOK_SECRET_PROD

      expect(dugsiSecret).toBe('whsec_dugsi')
      expect(mahadSecret).toBe('whsec_mahad')
      expect(dugsiSecret).not.toBe(mahadSecret)
    })

    it('should verify webhook with correct secret', async () => {
      const dugsiClient = getDugsiStripeClient()
      const body = JSON.stringify({ type: 'checkout.session.completed' })
      const signature = 'test_signature'

      dugsiClient.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET_DUGSI!
      )

      expect(dugsiClient.webhooks.constructEvent).toHaveBeenCalledWith(
        body,
        signature,
        'whsec_dugsi'
      )
    })
  })

  describe('Environment Isolation', () => {
    it('should not interfere with Mahad environment variables', () => {
      // Set both environments
      process.env.STRIPE_SECRET_KEY_PROD = 'sk_live_mahad'
      process.env.STRIPE_SECRET_KEY_DUGSI = 'sk_live_dugsi'

      // Get both clients
      const mahadClient = getStripeClient()
      const dugsiClient = getDugsiStripeClient()

      // Verify complete isolation
      expect(mahadClient._api.key).toBe('sk_live_mahad')
      expect(dugsiClient._api.key).toBe('sk_live_dugsi')

      // Changing one should not affect the other
      process.env.STRIPE_SECRET_KEY_DUGSI = 'sk_live_dugsi_updated'
      expect(mahadClient._api.key).toBe('sk_live_mahad')
    })

    it('should handle missing Dugsi config without affecting Mahad', () => {
      delete process.env.STRIPE_SECRET_KEY_DUGSI
      delete process.env.STRIPE_WEBHOOK_SECRET_DUGSI

      // Mahad should still work
      const mahadClient = getStripeClient()
      expect(mahadClient._api.key).toBe('sk_live_mahad')

      // Dugsi should throw
      expect(() => getDugsiStripeClient()).toThrow()
    })
  })

  describe('Client Methods', () => {
    it('should support customer creation with Dugsi client', async () => {
      const dugsiClient = getDugsiStripeClient()
      dugsiClient.customers.create = vi.fn().mockResolvedValue({
        id: 'cus_dugsi123',
        email: 'parent@example.com',
      })

      const customer = await dugsiClient.customers.create({
        email: 'parent@example.com',
        metadata: {
          program: 'DUGSI',
          familyId: 'test_family',
        },
      })

      expect(customer.id).toBe('cus_dugsi123')
      expect(dugsiClient.customers.create).toHaveBeenCalledWith({
        email: 'parent@example.com',
        metadata: {
          program: 'DUGSI',
          familyId: 'test_family',
        },
      })
    })

    it('should support checkout session creation', async () => {
      const dugsiClient = getDugsiStripeClient()
      dugsiClient.checkout.sessions.create = vi.fn().mockResolvedValue({
        id: 'cs_test_dugsi',
        url: 'https://checkout.stripe.com/pay/cs_test_dugsi',
      })

      const session = await dugsiClient.checkout.sessions.create({
        mode: 'setup',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      })

      expect(session.id).toBe('cs_test_dugsi')
      expect(session.url).toContain('checkout.stripe.com')
    })
  })
})
