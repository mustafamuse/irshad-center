/**
 * Webhook Rate Validation Tests
 *
 * Tests for rate validation in handleSubscriptionCreated.
 * Verifies that Mahad subscriptions are validated against calculated rates.
 */

import type Stripe from 'stripe'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ============================================================================
// Hoisted Mocks (fixes hoisting issues with vi.mock)
// ============================================================================

const {
  mockCalculateMahadRate,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
  mockLoggerDebug,
  mockGetBillingAccountByStripeCustomerId,
  mockGetSubscriptionByStripeId,
  mockGetBillingAssignmentsBySubscription,
  mockCreateOrUpdateBillingAccount,
  mockLinkSubscriptionToProfiles,
  mockUnlinkSubscription,
  mockCreateSubscriptionFromStripe,
  mockUpdateSubscriptionStatus,
} = vi.hoisted(() => ({
  mockCalculateMahadRate: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerDebug: vi.fn(),
  mockGetBillingAccountByStripeCustomerId: vi.fn(),
  mockGetSubscriptionByStripeId: vi.fn(),
  mockGetBillingAssignmentsBySubscription: vi.fn(),
  mockCreateOrUpdateBillingAccount: vi.fn(),
  mockLinkSubscriptionToProfiles: vi.fn(),
  mockUnlinkSubscription: vi.fn(),
  mockCreateSubscriptionFromStripe: vi.fn(),
  mockUpdateSubscriptionStatus: vi.fn(),
}))

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/utils/mahad-tuition', () => ({
  calculateMahadRate: (...args: unknown[]) => mockCalculateMahadRate(...args),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: mockLoggerDebug,
  })),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getBillingAccountByStripeCustomerId: (...args: unknown[]) =>
    mockGetBillingAccountByStripeCustomerId(...args),
  getSubscriptionByStripeId: (...args: unknown[]) =>
    mockGetSubscriptionByStripeId(...args),
  getBillingAssignmentsBySubscription: (...args: unknown[]) =>
    mockGetBillingAssignmentsBySubscription(...args),
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfilesByFamilyId: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/services/shared/billing-service', () => ({
  createOrUpdateBillingAccount: (...args: unknown[]) =>
    mockCreateOrUpdateBillingAccount(...args),
  linkSubscriptionToProfiles: (...args: unknown[]) =>
    mockLinkSubscriptionToProfiles(...args),
  unlinkSubscription: (...args: unknown[]) => mockUnlinkSubscription(...args),
}))

vi.mock('@/lib/services/shared/subscription-service', () => ({
  createSubscriptionFromStripe: (...args: unknown[]) =>
    mockCreateSubscriptionFromStripe(...args),
  updateSubscriptionStatus: (...args: unknown[]) =>
    mockUpdateSubscriptionStatus(...args),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      findFirst: vi.fn(),
    },
    billingAccount: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_options, fn) => fn()),
}))

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { handleSubscriptionCreated } from '../webhook-service'

// ============================================================================
// Test Utilities
// ============================================================================

function createMockSubscription(
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  return {
    id: 'sub_test123',
    object: 'subscription',
    customer: 'cus_test123',
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test',
          object: 'subscription_item',
          price: {
            id: 'price_test',
            object: 'price',
            unit_amount: 12000, // $120
            currency: 'usd',
          } as unknown as Stripe.Price,
        } as unknown as Stripe.SubscriptionItem,
      ],
    } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
    metadata: {
      profileId: 'profile-123',
      personId: 'person-456',
      studentName: 'Test Student',
      graduationStatus: 'NON_GRADUATE',
      paymentFrequency: 'MONTHLY',
      billingType: 'FULL_TIME',
      calculatedRate: '12000',
    },
    ...overrides,
  } as Stripe.Subscription
}

function createMockBillingAccount() {
  return {
    id: 'ba-123',
    personId: 'person-456',
    stripeCustomerIdMahad: 'cus_test123',
  }
}

function createMockDbSubscription() {
  return {
    id: 'db-sub-123',
    stripeSubscriptionId: 'sub_test123',
    status: 'active',
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('handleSubscriptionCreated - Rate Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mocks
    mockGetBillingAccountByStripeCustomerId.mockResolvedValue(
      createMockBillingAccount()
    )
    mockCreateSubscriptionFromStripe.mockResolvedValue(
      createMockDbSubscription()
    )
    mockCalculateMahadRate.mockReturnValue(12000)
    mockLinkSubscriptionToProfiles.mockResolvedValue(1)
    mockUnlinkSubscription.mockResolvedValue(undefined)
  })

  describe('Mahad subscription validation', () => {
    it('validates rate when metadata is present', async () => {
      const subscription = createMockSubscription()

      await handleSubscriptionCreated(subscription, 'MAHAD')

      // Should have called calculateMahadRate for validation
      expect(mockCalculateMahadRate).toHaveBeenCalled()
    })

    it('logs success when rates match', async () => {
      const subscription = createMockSubscription()
      mockCalculateMahadRate.mockReturnValue(12000)

      await handleSubscriptionCreated(subscription, 'MAHAD')

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'sub_test123',
          rateValid: true,
        }),
        'Mahad subscription rate validation completed'
      )
    })

    it('logs warning when Stripe amount differs from expected rate', async () => {
      // Stripe has $100 but metadata says expected $120
      const subscription = createMockSubscription({
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test',
              object: 'subscription_item',
              price: {
                id: 'price_test',
                object: 'price',
                unit_amount: 10000, // $100 - different from metadata's $120
                currency: 'usd',
              } as unknown as Stripe.Price,
            } as unknown as Stripe.SubscriptionItem,
          ],
        } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
      })

      mockCalculateMahadRate.mockReturnValue(12000) // Calculation matches metadata

      await handleSubscriptionCreated(subscription, 'MAHAD')

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeAmount: 10000,
          expectedRate: 12000,
        }),
        'Rate mismatch: Stripe amount differs from expected calculated rate'
      )
    })

    it('logs warning when recalculated rate differs from metadata rate', async () => {
      const subscription = createMockSubscription()

      // Recalculation returns different value than stored in metadata
      mockCalculateMahadRate.mockReturnValue(9500) // $95 instead of $120

      await handleSubscriptionCreated(subscription, 'MAHAD')

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          metadataRate: 12000,
          recalculatedRate: 9500,
        }),
        'Rate calculation mismatch: Stored metadata rate differs from recalculated rate'
      )
    })

    it('logs invalid rate when Stripe amount does not match expected', async () => {
      const subscription = createMockSubscription({
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test',
              object: 'subscription_item',
              price: {
                id: 'price_test',
                object: 'price',
                unit_amount: 10000, // $100
                currency: 'usd',
              } as unknown as Stripe.Price,
            } as unknown as Stripe.SubscriptionItem,
          ],
        } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
      })

      mockCalculateMahadRate.mockReturnValue(12000)

      await handleSubscriptionCreated(subscription, 'MAHAD')

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          rateValid: false,
        }),
        'Mahad subscription rate validation completed'
      )
    })
  })

  describe('Non-Mahad subscriptions', () => {
    it('skips validation for DUGSI subscriptions', async () => {
      const subscription = createMockSubscription()

      await handleSubscriptionCreated(subscription, 'DUGSI')

      // Should not call calculateMahadRate for DUGSI
      expect(mockCalculateMahadRate).not.toHaveBeenCalled()
    })
  })

  describe('Incomplete metadata', () => {
    it('skips validation when metadata is missing', async () => {
      const subscription = createMockSubscription({
        metadata: {},
      })

      await handleSubscriptionCreated(subscription, 'MAHAD')

      // Should not call calculateMahadRate when no metadata
      expect(mockCalculateMahadRate).not.toHaveBeenCalled()
    })

    it('skips validation when calculatedRate is missing', async () => {
      const subscription = createMockSubscription({
        metadata: {
          profileId: 'profile-123',
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
          // Missing calculatedRate
        },
      })

      await handleSubscriptionCreated(subscription, 'MAHAD')

      // Should not call calculateMahadRate when calculatedRate missing
      expect(mockCalculateMahadRate).not.toHaveBeenCalled()
    })

    it('skips validation when graduationStatus is missing', async () => {
      const subscription = createMockSubscription({
        metadata: {
          profileId: 'profile-123',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
          calculatedRate: '12000',
          // Missing graduationStatus
        },
      })

      await handleSubscriptionCreated(subscription, 'MAHAD')

      expect(mockCalculateMahadRate).not.toHaveBeenCalled()
    })
  })

  describe('Validation logging details', () => {
    it('includes all relevant fields in validation log', async () => {
      const subscription = createMockSubscription()
      mockCalculateMahadRate.mockReturnValue(12000)

      await handleSubscriptionCreated(subscription, 'MAHAD')

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'sub_test123',
          profileId: 'profile-123',
          studentName: 'Test Student',
          stripeAmount: 12000,
          expectedRate: 12000,
          graduationStatus: 'NON_GRADUATE',
          paymentFrequency: 'MONTHLY',
          billingType: 'FULL_TIME',
          rateValid: true,
        }),
        'Mahad subscription rate validation completed'
      )
    })
  })
})
