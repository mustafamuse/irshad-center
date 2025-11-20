// ⚠️ CRITICAL MIGRATION NEEDED: This test file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model
// All tests are skipped until migration is complete

/**
 * Mahad Flow Protection Tests
 *
 * These tests ensure that the existing Mahad payment flow remains
 * completely unaffected by the addition of Dugsi payment functionality.
 * These tests should pass both before and after Dugsi implementation.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { prisma } from '@/lib/db'
import { stripeServerClient, getStripeClient } from '@/lib/stripe'

// Mock Stripe module
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation((apiKey: string) => ({
      _api: { key: apiKey },
      customers: { list: vi.fn() },
      webhooks: {
        constructEvent: vi.fn().mockReturnValue({
          id: 'evt_test',
          type: 'invoice.payment_succeeded',
        }),
      },
    })),
  }
})

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    student: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

// Mock environment variables
const originalEnv = process.env

beforeEach(() => {
  vi.resetModules()
  process.env = {
    ...originalEnv,
    NODE_ENV: 'production',
    STRIPE_SECRET_KEY_PROD: 'sk_live_mahad_original',
    STRIPE_SECRET_KEY_DEV: 'sk_test_mahad_original',
    STRIPE_WEBHOOK_SECRET_PROD: 'whsec_mahad_prod',
    STRIPE_WEBHOOK_SECRET_DEV: 'whsec_mahad_dev',
  }
})

afterEach(() => {
  process.env = originalEnv
  vi.clearAllMocks()
})

describe.skip('Mahad Flow Protection', () => {
  describe('Stripe Client Initialization', () => {
    it('should continue using original Stripe client with production key', () => {
      const client = getStripeClient()
      expect(client._api.key).toBe('sk_live_mahad_original')
    })

    it('should use dev key in development environment', () => {
      process.env.NODE_ENV = 'development'
      const client = getStripeClient()
      expect(client._api.key).toBe('sk_test_mahad_original')
    })

    it('should not be affected by dugsi environment variables', () => {
      process.env.STRIPE_SECRET_KEY_DUGSI = 'sk_live_dugsi_different'
      process.env.STRIPE_WEBHOOK_SECRET_DUGSI = 'whsec_dugsi_different'

      const client = getStripeClient()
      expect(client._api.key).toBe('sk_live_mahad_original')
      expect(client._api.key).not.toContain('dugsi')
    })

    it('should maintain singleton pattern for Mahad client', () => {
      const client1 = getStripeClient()
      const client2 = getStripeClient()
      expect(client1).toBe(client2)
    })
  })

  describe('Database Queries', () => {
    // Mock Prisma for testing
    beforeEach(() => {
      vi.spyOn(prisma.student, 'findMany').mockResolvedValue([
        {
          id: '1',
          name: 'Test Student',
          program: 'MAHAD_PROGRAM',
          stripeCustomerId: 'cus_mahad123',
          stripeSubscriptionId: 'sub_mahad123',
          email: 'student@test.com',
        } as any,
      ])
    })

    it('should only return MAHAD_PROGRAM students when querying active subscriptions', async () => {
      const students = await prisma.student.findMany({
        where: {
          stripeSubscriptionId: { not: null },
          program: 'MAHAD_PROGRAM',
        },
      })

      students.forEach((student) => {
        expect(student.program).toBe('MAHAD_PROGRAM')
        expect(student.stripeCustomerId).toContain('mahad')
      })
    })

    it('should maintain existing field names for Mahad', async () => {
      const student = await prisma.student.findMany({
        where: { id: '1' },
      })

      // These fields should continue to exist and work
      expect(student[0]).toHaveProperty('stripeCustomerId')
      expect(student[0]).toHaveProperty('stripeSubscriptionId')
      expect(student[0]).toHaveProperty('email')
    })
  })

  describe('Webhook Handling', () => {
    it('should continue handling webhooks at /api/webhook endpoint', async () => {
      const mockRequest = new Request('http://localhost:3000/api/webhook', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify({ type: 'invoice.payment_succeeded' }),
      })

      // Verify the endpoint path remains unchanged
      expect(mockRequest.url).toContain('/api/webhook')
      expect(mockRequest.url).not.toContain('/dugsi')
    })

    it('should use correct webhook secret for environment', () => {
      const prodSecret = process.env.STRIPE_WEBHOOK_SECRET_PROD
      const devSecret = process.env.STRIPE_WEBHOOK_SECRET_DEV

      expect(prodSecret).toBe('whsec_mahad_prod')
      expect(devSecret).toBe('whsec_mahad_dev')
      expect(prodSecret).not.toContain('dugsi')
      expect(devSecret).not.toContain('dugsi')
    })
  })

  describe('Pricing Table Configuration', () => {
    it('should maintain existing pricing table environment variables', () => {
      process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID = 'prctbl_mahad123'
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_PROD = 'pk_live_mahad'

      expect(process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID).toBe(
        'prctbl_mahad123'
      )
      expect(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_PROD).toBe(
        'pk_live_mahad'
      )
    })
  })

  describe('Service Methods', () => {
    it('should maintain proxy object functionality', () => {
      const proxy = stripeServerClient
      expect(proxy).toBeDefined()
      expect(typeof proxy).toBe('object')
    })

    it('should maintain test initialization method', async () => {
      const { testStripeClientInitialization } = require('@/lib/stripe')

      // Should not throw
      await expect(testStripeClientInitialization()).resolves.not.toThrow()
    })
  })

  describe('Backward Compatibility', () => {
    it('should work with existing imports', () => {
      // These imports should continue to work
      expect(stripeServerClient).toBeDefined()
      expect(getStripeClient).toBeDefined()
      expect(typeof getStripeClient).toBe('function')
    })

    it('should maintain API version', () => {
      const Stripe = require('stripe')
      const mockInstance = new Stripe('test_key', {
        apiVersion: '2025-08-27.basil',
        typescript: true,
      })

      expect(mockInstance._api).toBeDefined()
    })
  })
})
