/**
 * Dugsi Checkout Service Tests
 *
 * Tests for isPrimaryPayer selection logic in createDugsiCheckoutSession.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPrismaFindMany,
  mockAssignmentFindMany,
  mockStripeSessionCreate,
  mockLoggerInfo,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockPrismaFindMany: vi.fn(),
  mockAssignmentFindMany: vi.fn(),
  mockStripeSessionCreate: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    programProfile: {
      findMany: (...args: unknown[]) => mockPrismaFindMany(...args),
    },
    billingAssignment: {
      findMany: (...args: unknown[]) => mockAssignmentFindMany(...args),
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
    mockAssignmentFindMany.mockResolvedValue([])
    mockStripeSessionCreate.mockResolvedValue({
      id: 'sess_test123',
      url: 'https://checkout.stripe.com/test',
    })
  })

  describe('existing subscription guard', () => {
    it('rejects checkout when the family already has a live subscription', async () => {
      mockAssignmentFindMany.mockResolvedValue([
        {
          subscriptionId: 'db_sub_1',
          subscription: { id: 'db_sub_1', status: 'active' },
        },
      ])

      await expect(
        createDugsiCheckoutSession({ familyId: 'family-1' })
      ).rejects.toMatchObject({ code: 'ACTIVE_SUBSCRIPTION' })
      expect(mockStripeSessionCreate).not.toHaveBeenCalled()
    })

    it('rejects checkout when the family subscription is paused', async () => {
      mockAssignmentFindMany.mockResolvedValue([
        {
          subscriptionId: 'db_sub_1',
          subscription: { id: 'db_sub_1', status: 'paused' },
        },
      ])

      await expect(
        createDugsiCheckoutSession({ familyId: 'family-1' })
      ).rejects.toMatchObject({ code: 'ACTIVE_SUBSCRIPTION' })
    })
  })

  describe('isPrimaryPayer selection', () => {
    it('should select guardian with isPrimaryPayer=true when available', async () => {
      const primaryPayerGuardian = {
        id: 'guardian-primary',
        name: 'Primary Payer Parent',
        email: 'primary@test.com',
        phone: null,
        billingAccounts: [],
      }

      const nonPrimaryGuardian = {
        id: 'guardian-other',
        name: 'Other Parent',
        email: 'other@test.com',
        phone: null,
        billingAccounts: [],
      }

      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'profile-1',
          person: {
            name: 'Child 1',
            dependentRelationships: [
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

    it('should throw error when no guardian has isPrimaryPayer set', async () => {
      const firstGuardian = {
        id: 'guardian-first',
        name: 'First Parent',
        email: 'first@test.com',
        phone: null,
        billingAccounts: [],
      }

      const secondGuardian = {
        id: 'guardian-second',
        name: 'Second Parent',
        email: 'second@test.com',
        phone: null,
        billingAccounts: [],
      }

      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'profile-1',
          person: {
            name: 'Child 1',
            dependentRelationships: [
              { isPrimaryPayer: false, guardian: firstGuardian },
              { isPrimaryPayer: false, guardian: secondGuardian },
            ],
          },
        },
      ])

      await expect(
        createDugsiCheckoutSession({ familyId: 'family-123' })
      ).rejects.toMatchObject({
        message:
          'No primary payer designated for this family. Please set a primary payer before checkout.',
        field: 'primaryPayer',
      })
    })

    it('should use existing Stripe customer ID from primary payer', async () => {
      const primaryPayerGuardian = {
        id: 'guardian-primary',
        name: 'Primary Payer',
        email: 'primary@test.com',
        phone: null,
        billingAccounts: [{ stripeCustomerIdDugsi: 'cus_existing123' }],
      }

      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'profile-1',
          person: {
            name: 'Child 1',
            dependentRelationships: [
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

    it('should select first isPrimaryPayer guardian when multiple have flag set', async () => {
      const firstPrimaryPayer = {
        id: 'guardian-first-primary',
        name: 'First Primary',
        email: 'first@test.com',
        phone: null,
        billingAccounts: [],
      }

      const secondPrimaryPayer = {
        id: 'guardian-second-primary',
        name: 'Second Primary',
        email: 'second@test.com',
        phone: null,
        billingAccounts: [],
      }

      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'profile-1',
          person: {
            name: 'Child 1',
            dependentRelationships: [
              { isPrimaryPayer: true, guardian: firstPrimaryPayer },
              { isPrimaryPayer: true, guardian: secondPrimaryPayer },
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

    it('should throw error when primary payer has no email', async () => {
      const guardianNoEmail = {
        id: 'guardian-no-email',
        name: 'No Email Parent',
        email: null,
        phone: null,
        billingAccounts: [],
      }

      mockPrismaFindMany.mockResolvedValue([
        {
          id: 'profile-1',
          person: {
            name: 'Child 1',
            dependentRelationships: [
              { isPrimaryPayer: true, guardian: guardianNoEmail },
            ],
          },
        },
      ])

      await expect(
        createDugsiCheckoutSession({ familyId: 'family-123' })
      ).rejects.toMatchObject({
        message:
          'Guardian must have an email address on file to receive payment link',
        field: 'guardianEmail',
      })
    })
  })

  describe('payment method types', () => {
    const mockGuardianWithEmail = {
      id: 'guardian-1',
      name: 'Test Parent',
      email: 'test@example.com',
      phone: null,
      billingAccounts: [],
    }

    const mockProfile = {
      id: 'profile-1',
      person: {
        name: 'Child 1',
        dependentRelationships: [
          { isPrimaryPayer: true, guardian: mockGuardianWithEmail },
        ],
      },
    }

    beforeEach(() => {
      mockPrismaFindMany.mockResolvedValue([mockProfile])
    })

    it('should include card and ACH when feature flag is enabled', async () => {
      vi.stubEnv('DUGSI_CARD_PAYMENTS_ENABLED', 'true')

      await createDugsiCheckoutSession({ familyId: 'family-123' })

      expect(mockStripeSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card', 'us_bank_account'],
        })
      )
    })

    it('should only include ACH when feature flag is disabled', async () => {
      vi.stubEnv('DUGSI_CARD_PAYMENTS_ENABLED', 'false')

      await createDugsiCheckoutSession({ familyId: 'family-123' })

      expect(mockStripeSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['us_bank_account'],
        })
      )
    })

    it('should only include ACH when feature flag is not set', async () => {
      vi.stubEnv('DUGSI_CARD_PAYMENTS_ENABLED', '')

      await createDugsiCheckoutSession({ familyId: 'family-123' })

      expect(mockStripeSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['us_bank_account'],
        })
      )
    })
  })
})
