/**
 * Dugsi Checkout Service Tests
 *
 * Tests for isPrimaryPayer selection logic in createDugsiCheckoutSession.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPrismaFindMany,
  mockStripeSessionCreate,
  mockLoggerInfo,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockPrismaFindMany: vi.fn(),
  mockStripeSessionCreate: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findMany: (...args: unknown[]) => mockPrismaFindMany(...args),
    },
  },
}))

vi.mock('@/lib/stripe-dugsi', () => ({
  getDugsiStripeClient: vi.fn(() => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeSessionCreate(...args),
      },
    },
  })),
}))

vi.mock('@/lib/keys/stripe', () => ({
  getDugsiKeys: vi.fn(() => ({
    productId: 'prod_test123',
  })),
}))

vi.mock('@/lib/utils/env', () => ({
  getAppUrl: vi.fn(() => 'https://test.app'),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logWarning: vi.fn(),
  logError: vi.fn(),
}))

import { createDugsiCheckoutSession } from '../checkout-service'

describe('createDugsiCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStripeSessionCreate.mockResolvedValue({
      id: 'sess_test123',
      url: 'https://checkout.stripe.com/test',
    })
  })

  describe('isPrimaryPayer selection', () => {
    it('should select guardian with isPrimaryPayer=true when available', async () => {
      const primaryPayerGuardian = {
        id: 'guardian-primary',
        name: 'Primary Payer Parent',
        contactPoints: [{ value: 'primary@test.com', type: 'EMAIL' }],
        billingAccounts: [],
      }

      const nonPrimaryGuardian = {
        id: 'guardian-other',
        name: 'Other Parent',
        contactPoints: [{ value: 'other@test.com', type: 'EMAIL' }],
        billingAccounts: [],
      }

      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'profile-1',
          person: {
            name: 'Child 1',
            guardianRelationships: [
              { isPrimaryPayer: false, guardian: nonPrimaryGuardian },
              { isPrimaryPayer: true, guardian: primaryPayerGuardian },
            ],
          },
        },
      ])

      await createDugsiCheckoutSession({ familyId: 'family-123' })

      expect(mockStripeSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: 'primary@test.com',
        })
      )
    })

    it('should fallback to first guardian when no isPrimaryPayer is set', async () => {
      const firstGuardian = {
        id: 'guardian-first',
        name: 'First Parent',
        contactPoints: [{ value: 'first@test.com', type: 'EMAIL' }],
        billingAccounts: [],
      }

      const secondGuardian = {
        id: 'guardian-second',
        name: 'Second Parent',
        contactPoints: [{ value: 'second@test.com', type: 'EMAIL' }],
        billingAccounts: [],
      }

      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'profile-1',
          person: {
            name: 'Child 1',
            guardianRelationships: [
              { isPrimaryPayer: false, guardian: firstGuardian },
              { isPrimaryPayer: false, guardian: secondGuardian },
            ],
          },
        },
      ])

      await createDugsiCheckoutSession({ familyId: 'family-123' })

      expect(mockStripeSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: 'first@test.com',
        })
      )
    })

    it('should use existing Stripe customer ID from primary payer', async () => {
      const primaryPayerGuardian = {
        id: 'guardian-primary',
        name: 'Primary Payer',
        contactPoints: [{ value: 'primary@test.com', type: 'EMAIL' }],
        billingAccounts: [{ stripeCustomerIdDugsi: 'cus_existing123' }],
      }

      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'profile-1',
          person: {
            name: 'Child 1',
            guardianRelationships: [
              { isPrimaryPayer: true, guardian: primaryPayerGuardian },
            ],
          },
        },
      ])

      await createDugsiCheckoutSession({ familyId: 'family-123' })

      expect(mockStripeSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing123',
          customer_email: undefined,
        })
      )
    })
  })
})
