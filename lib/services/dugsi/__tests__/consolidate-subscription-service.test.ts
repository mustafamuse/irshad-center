/**
 * Consolidate Subscription Service Tests
 *
 * Tests for linking Stripe subscriptions to families in the database.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockStripeSubscriptionRetrieve,
  mockStripeSubscriptionUpdate,
  mockStripeCustomerUpdate,
  mockGetSubscriptionByStripeId,
  mockCreateSubscription,
  mockUpsertBillingAccount,
  mockGetProgramProfilesByFamilyId,
  mockLinkSubscriptionToProfiles,
  mockUnlinkSubscription,
  mockPrismaSubscriptionUpdate,
  mockLoggerInfo,
  mockLogError,
} = vi.hoisted(() => ({
  mockStripeSubscriptionRetrieve: vi.fn(),
  mockStripeSubscriptionUpdate: vi.fn(),
  mockStripeCustomerUpdate: vi.fn(),
  mockGetSubscriptionByStripeId: vi.fn(),
  mockCreateSubscription: vi.fn(),
  mockUpsertBillingAccount: vi.fn(),
  mockGetProgramProfilesByFamilyId: vi.fn(),
  mockLinkSubscriptionToProfiles: vi.fn(),
  mockUnlinkSubscription: vi.fn(),
  mockPrismaSubscriptionUpdate: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/stripe-dugsi', () => ({
  getDugsiStripeClient: vi.fn(() => ({
    subscriptions: {
      retrieve: mockStripeSubscriptionRetrieve,
      update: mockStripeSubscriptionUpdate,
    },
    customers: {
      update: mockStripeCustomerUpdate,
    },
  })),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    subscription: {
      update: mockPrismaSubscriptionUpdate,
    },
  },
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getSubscriptionByStripeId: mockGetSubscriptionByStripeId,
  createSubscription: mockCreateSubscription,
  upsertBillingAccount: mockUpsertBillingAccount,
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfilesByFamilyId: mockGetProgramProfilesByFamilyId,
}))

vi.mock('@/lib/services/shared/billing-service', () => ({
  linkSubscriptionToProfiles: mockLinkSubscriptionToProfiles,
  unlinkSubscription: mockUnlinkSubscription,
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logWarning: vi.fn(),
  logError: mockLogError,
}))

vi.mock('@/lib/utils/dugsi-tuition', () => ({
  formatRateDisplay: vi.fn((amount: number) => `$${amount / 100}/month`),
  getRateTierDescription: vi.fn(() => '2 children'),
}))

import {
  previewStripeSubscription,
  consolidateStripeSubscription,
} from '../consolidate-subscription-service'

describe('consolidate-subscription-service', () => {
  const mockCustomer = {
    id: 'cus_test123',
    name: 'John Doe',
    email: 'john@example.com',
    deleted: false,
  }

  const mockSubscription = {
    id: 'sub_test123',
    status: 'active',
    customer: mockCustomer,
    currency: 'usd',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    items: {
      data: [
        {
          price: {
            unit_amount: 16000,
            recurring: { interval: 'month' },
          },
        },
      ],
    },
  }

  const mockPrimaryPayer = {
    id: 'guardian-123',
    name: 'John Doe',
    contactPoints: [
      { type: 'EMAIL', value: 'john@example.com' },
      { type: 'PHONE', value: '+16125551234' },
    ],
  }

  const mockFamilyProfiles = [
    {
      id: 'profile-1',
      familyReferenceId: 'family-123',
      person: {
        id: 'child-1',
        name: 'Child One',
        dependentRelationships: [
          { isPrimaryPayer: true, guardian: mockPrimaryPayer },
        ],
      },
    },
    {
      id: 'profile-2',
      familyReferenceId: 'family-123',
      person: {
        id: 'child-2',
        name: 'Child Two',
        dependentRelationships: [
          { isPrimaryPayer: true, guardian: mockPrimaryPayer },
        ],
      },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockStripeSubscriptionRetrieve.mockResolvedValue(mockSubscription)
    mockGetProgramProfilesByFamilyId.mockResolvedValue(mockFamilyProfiles)
    mockGetSubscriptionByStripeId.mockResolvedValue(null)
    mockUpsertBillingAccount.mockResolvedValue({ id: 'billing-123' })
    mockCreateSubscription.mockResolvedValue({ id: 'sub-db-123' })
    mockLinkSubscriptionToProfiles.mockResolvedValue(2)
    mockStripeSubscriptionUpdate.mockResolvedValue({})
    mockStripeCustomerUpdate.mockResolvedValue({})
  })

  describe('previewStripeSubscription', () => {
    it('should return preview data with matching customer details', async () => {
      const preview = await previewStripeSubscription(
        'sub_test123',
        'family-123'
      )

      expect(preview).toMatchObject({
        subscriptionId: 'sub_test123',
        customerId: 'cus_test123',
        status: 'active',
        amount: 16000,
        stripeCustomerName: 'John Doe',
        stripeCustomerEmail: 'john@example.com',
        dbPayerName: 'John Doe',
        dbPayerEmail: 'john@example.com',
        hasMismatch: false,
        nameMismatch: false,
        emailMismatch: false,
        isAlreadyLinked: false,
      })
    })

    it('should detect name mismatch', async () => {
      mockStripeSubscriptionRetrieve.mockResolvedValue({
        ...mockSubscription,
        customer: {
          ...mockCustomer,
          name: 'Different Person',
        },
      })

      const preview = await previewStripeSubscription(
        'sub_test123',
        'family-123'
      )

      expect(preview.hasMismatch).toBe(true)
      expect(preview.nameMismatch).toBe(true)
      expect(preview.emailMismatch).toBe(false)
    })

    it('should detect email mismatch', async () => {
      mockStripeSubscriptionRetrieve.mockResolvedValue({
        ...mockSubscription,
        customer: {
          ...mockCustomer,
          email: 'different@example.com',
        },
      })

      const preview = await previewStripeSubscription(
        'sub_test123',
        'family-123'
      )

      expect(preview.hasMismatch).toBe(true)
      expect(preview.nameMismatch).toBe(false)
      expect(preview.emailMismatch).toBe(true)
    })

    it('should detect already linked subscription', async () => {
      mockGetSubscriptionByStripeId.mockResolvedValue({
        id: 'sub-db-123',
        assignments: [
          {
            programProfile: {
              familyReferenceId: 'other-family-456',
            },
          },
        ],
      })

      const otherFamilyProfiles = [
        {
          id: 'profile-other',
          person: {
            dependentRelationships: [
              {
                isPrimaryPayer: true,
                guardian: { name: 'Other Parent' },
              },
            ],
          },
        },
      ]

      mockGetProgramProfilesByFamilyId
        .mockResolvedValueOnce(mockFamilyProfiles)
        .mockResolvedValueOnce(otherFamilyProfiles)

      const preview = await previewStripeSubscription(
        'sub_test123',
        'family-123'
      )

      expect(preview.isAlreadyLinked).toBe(true)
      expect(preview.existingFamilyId).toBe('other-family-456')
      expect(preview.existingFamilyName).toBe('Other Parent')
    })

    it('should throw error when subscription not found', async () => {
      mockStripeSubscriptionRetrieve.mockResolvedValue(null)

      await expect(
        previewStripeSubscription('sub_notfound', 'family-123')
      ).rejects.toThrow('Subscription not found in Stripe')
    })

    it('should throw error when family not found', async () => {
      mockGetProgramProfilesByFamilyId.mockResolvedValue([])

      await expect(
        previewStripeSubscription('sub_test123', 'family-notfound')
      ).rejects.toThrow('Family not found or no active children')
    })

    it('should throw error when no primary payer set', async () => {
      mockGetProgramProfilesByFamilyId.mockResolvedValue([
        {
          id: 'profile-1',
          person: {
            dependentRelationships: [
              { isPrimaryPayer: false, guardian: mockPrimaryPayer },
            ],
          },
        },
      ])

      await expect(
        previewStripeSubscription('sub_test123', 'family-123')
      ).rejects.toThrow('No primary payer found for this family')
    })
  })

  describe('consolidateStripeSubscription', () => {
    it('should create new subscription and link to family', async () => {
      const result = await consolidateStripeSubscription({
        stripeSubscriptionId: 'sub_test123',
        familyId: 'family-123',
        syncStripeCustomer: false,
      })

      expect(mockUpsertBillingAccount).toHaveBeenCalledWith({
        personId: 'guardian-123',
        accountType: 'DUGSI',
        stripeCustomerIdDugsi: 'cus_test123',
        paymentMethodCaptured: true,
        paymentMethodCapturedAt: expect.any(Date),
      })

      expect(mockCreateSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: 'sub_test123',
          stripeCustomerId: 'cus_test123',
          status: 'active',
          amount: 16000,
        })
      )

      expect(mockLinkSubscriptionToProfiles).toHaveBeenCalledWith(
        'sub-db-123',
        ['profile-1', 'profile-2'],
        16000,
        'Consolidated via admin'
      )

      expect(result).toMatchObject({
        subscriptionId: 'sub_test123',
        billingAccountId: 'billing-123',
        assignmentsCreated: 2,
        stripeMetadataUpdated: true,
        stripeCustomerSynced: false,
      })
    })

    it('should sync Stripe customer when requested', async () => {
      const result = await consolidateStripeSubscription({
        stripeSubscriptionId: 'sub_test123',
        familyId: 'family-123',
        syncStripeCustomer: true,
      })

      expect(mockStripeCustomerUpdate).toHaveBeenCalledWith('cus_test123', {
        name: 'John Doe',
        email: 'john@example.com',
      })

      expect(result.stripeCustomerSynced).toBe(true)
    })

    it('should update existing subscription rather than create new', async () => {
      mockGetSubscriptionByStripeId.mockResolvedValue({
        id: 'existing-sub-123',
        assignments: [],
      })

      await consolidateStripeSubscription({
        stripeSubscriptionId: 'sub_test123',
        familyId: 'family-123',
        syncStripeCustomer: false,
      })

      expect(mockCreateSubscription).not.toHaveBeenCalled()
      expect(mockPrismaSubscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-sub-123' },
        })
      )
    })

    it('should reject when subscription already linked without forceOverride', async () => {
      mockGetSubscriptionByStripeId.mockResolvedValue({
        id: 'existing-sub-123',
        assignments: [
          {
            programProfile: {
              familyReferenceId: 'other-family-456',
            },
          },
        ],
      })

      await expect(
        consolidateStripeSubscription({
          stripeSubscriptionId: 'sub_test123',
          familyId: 'family-123',
          syncStripeCustomer: false,
        })
      ).rejects.toThrow(
        'Subscription is already linked to another family. Use forceOverride to move it.'
      )
    })

    it('should unlink from previous family when forceOverride is true', async () => {
      mockGetSubscriptionByStripeId.mockResolvedValue({
        id: 'existing-sub-123',
        assignments: [
          {
            programProfile: {
              familyReferenceId: 'other-family-456',
            },
          },
        ],
      })

      const result = await consolidateStripeSubscription({
        stripeSubscriptionId: 'sub_test123',
        familyId: 'family-123',
        syncStripeCustomer: false,
        forceOverride: true,
      })

      expect(mockUnlinkSubscription).toHaveBeenCalledWith('existing-sub-123')
      expect(result.previousFamilyUnlinked).toBe(true)
    })

    it('should update Stripe subscription metadata', async () => {
      await consolidateStripeSubscription({
        stripeSubscriptionId: 'sub_test123',
        familyId: 'family-123',
        syncStripeCustomer: false,
      })

      expect(mockStripeSubscriptionUpdate).toHaveBeenCalledWith(
        'sub_test123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            familyId: 'family-123',
            guardianPersonId: 'guardian-123',
            childCount: '2',
            source: 'admin-consolidation',
          }),
        })
      )
    })
  })
})
