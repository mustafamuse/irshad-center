/**
 * Shared Billing Service Tests
 *
 * Tests for cross-program billing operations.
 * Focus on billing accounts, subscriptions, and payment assignment logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../utils/prisma-mock'
import {
  billingAccountFactory,
  billingAssignmentFactory,
  subscriptionFactory,
  personFactory,
} from '../../utils/factories'
import {
  getBillingAccountByCustomerId,
  createOrUpdateBillingAccount,
  linkSubscriptionToProfiles,
  unlinkSubscription,
  calculateSplitAmounts,
  getBillingStatusByEmail,
  getBillingStatusForProfiles,
} from '@/lib/services/shared/billing-service'

// Mock dependencies
vi.mock('@/lib/db/queries/billing', () => ({
  getBillingAccountByStripeCustomerId: vi.fn(),
  upsertBillingAccount: vi.fn(),
  createBillingAssignment: vi.fn(),
  updateBillingAssignmentStatus: vi.fn(),
  getBillingAssignmentsByProfile: vi.fn(),
  getBillingAssignmentsBySubscription: vi.fn(),
}))

import {
  getBillingAccountByStripeCustomerId,
  upsertBillingAccount,
  createBillingAssignment,
  updateBillingAssignmentStatus,
  getBillingAssignmentsByProfile,
  getBillingAssignmentsBySubscription,
} from '@/lib/db/queries/billing'

describe('BillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBillingAccountByCustomerId', () => {
    it('should return billing account for MAHAD customer', async () => {
      const account = billingAccountFactory({
        stripeCustomerIdMahad: 'cus_mahad_123',
      })

      vi.mocked(getBillingAccountByStripeCustomerId).mockResolvedValue(
        account as any
      )

      const result = await getBillingAccountByCustomerId(
        'cus_mahad_123',
        'MAHAD'
      )

      expect(result).toEqual(account)
      expect(getBillingAccountByStripeCustomerId).toHaveBeenCalledWith(
        'cus_mahad_123',
        'MAHAD'
      )
    })

    it('should return null if account not found', async () => {
      vi.mocked(getBillingAccountByStripeCustomerId).mockResolvedValue(null)

      const result = await getBillingAccountByCustomerId(
        'cus_notfound',
        'DUGSI'
      )

      expect(result).toBeNull()
    })
  })

  describe('createOrUpdateBillingAccount', () => {
    it('should create MAHAD billing account with customer ID', async () => {
      const account = billingAccountFactory({
        stripeCustomerIdMahad: 'cus_mahad_123',
      })

      vi.mocked(upsertBillingAccount).mockResolvedValue(account as any)

      const result = await createOrUpdateBillingAccount({
        personId: 'person-1',
        accountType: 'MAHAD',
        stripeCustomerId: 'cus_mahad_123',
      })

      expect(result).toEqual(account)
      expect(upsertBillingAccount).toHaveBeenCalledWith({
        personId: 'person-1',
        accountType: 'MAHAD',
        stripeCustomerIdMahad: 'cus_mahad_123',
      })
    })

    it('should create DUGSI billing account with customer and payment intent', async () => {
      const account = billingAccountFactory({
        stripeCustomerIdDugsi: 'cus_dugsi_123',
      })

      vi.mocked(upsertBillingAccount).mockResolvedValue(account as any)

      await createOrUpdateBillingAccount({
        personId: 'person-1',
        accountType: 'DUGSI',
        stripeCustomerId: 'cus_dugsi_123',
        paymentIntentId: 'pi_123456',
      })

      expect(upsertBillingAccount).toHaveBeenCalledWith({
        personId: 'person-1',
        accountType: 'DUGSI',
        stripeCustomerIdDugsi: 'cus_dugsi_123',
        paymentIntentIdDugsi: 'pi_123456',
      })
    })

    it('should create YOUTH_EVENTS billing account', async () => {
      const account = billingAccountFactory({
        stripeCustomerIdYouth: 'cus_youth_123',
      })

      vi.mocked(upsertBillingAccount).mockResolvedValue(account as any)

      await createOrUpdateBillingAccount({
        personId: 'person-1',
        accountType: 'YOUTH_EVENTS',
        stripeCustomerId: 'cus_youth_123',
      })

      expect(upsertBillingAccount).toHaveBeenCalledWith({
        personId: 'person-1',
        accountType: 'YOUTH_EVENTS',
        stripeCustomerIdYouth: 'cus_youth_123',
      })
    })

    it('should create GENERAL_DONATION billing account', async () => {
      const account = billingAccountFactory({
        stripeCustomerIdDonation: 'cus_donation_123',
      })

      vi.mocked(upsertBillingAccount).mockResolvedValue(account as any)

      await createOrUpdateBillingAccount({
        personId: 'person-1',
        accountType: 'GENERAL_DONATION',
        stripeCustomerId: 'cus_donation_123',
      })

      expect(upsertBillingAccount).toHaveBeenCalledWith({
        personId: 'person-1',
        accountType: 'GENERAL_DONATION',
        stripeCustomerIdDonation: 'cus_donation_123',
      })
    })

    it('should include payment method capture info', async () => {
      const account = billingAccountFactory({
        paymentMethodCaptured: true,
      })
      const capturedAt = new Date()

      vi.mocked(upsertBillingAccount).mockResolvedValue(account as any)

      await createOrUpdateBillingAccount({
        personId: 'person-1',
        accountType: 'MAHAD',
        stripeCustomerId: 'cus_123',
        paymentMethodCaptured: true,
        paymentMethodCapturedAt: capturedAt,
      })

      expect(upsertBillingAccount).toHaveBeenCalledWith({
        personId: 'person-1',
        accountType: 'MAHAD',
        stripeCustomerIdMahad: 'cus_123',
        paymentMethodCaptured: true,
        paymentMethodCapturedAt: capturedAt,
      })
    })

    it('should handle null personId', async () => {
      const account = billingAccountFactory()

      vi.mocked(upsertBillingAccount).mockResolvedValue(account as any)

      await createOrUpdateBillingAccount({
        personId: null,
        accountType: 'MAHAD',
      })

      expect(upsertBillingAccount).toHaveBeenCalledWith({
        personId: null,
        accountType: 'MAHAD',
      })
    })
  })

  describe('linkSubscriptionToProfiles', () => {
    it('should throw error if no profile IDs provided', async () => {
      await expect(
        linkSubscriptionToProfiles('sub-1', [], 15000)
      ).rejects.toThrow('At least one profile ID is required')
    })

    it('should create single assignment for one profile', async () => {
      prismaMock.billingAssignment.findMany.mockResolvedValue([])
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      vi.mocked(createBillingAssignment).mockResolvedValue({} as any)

      const result = await linkSubscriptionToProfiles(
        'sub-1',
        ['profile-1'],
        15000
      )

      expect(result).toBe(1)
      expect(createBillingAssignment).toHaveBeenCalledWith(
        {
          subscriptionId: 'sub-1',
          programProfileId: 'profile-1',
          amount: 15000,
          percentage: null, // Single profile gets null percentage
          notes: undefined,
        },
        prismaMock
      )
    })

    it('should split amount evenly for multiple profiles', async () => {
      prismaMock.billingAssignment.findMany.mockResolvedValue([])
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      vi.mocked(createBillingAssignment).mockResolvedValue({} as any)

      const result = await linkSubscriptionToProfiles(
        'sub-1',
        ['profile-1', 'profile-2'],
        1000
      )

      expect(result).toBe(2)
      expect(createBillingAssignment).toHaveBeenCalledTimes(2)

      // First profile gets 500 (50%)
      expect(createBillingAssignment).toHaveBeenCalledWith(
        {
          subscriptionId: 'sub-1',
          programProfileId: 'profile-1',
          amount: 500,
          percentage: 50,
          notes: undefined,
        },
        prismaMock
      )

      // Second profile gets 500 (50%)
      expect(createBillingAssignment).toHaveBeenCalledWith(
        {
          subscriptionId: 'sub-1',
          programProfileId: 'profile-2',
          amount: 500,
          percentage: 50,
          notes: undefined,
        },
        prismaMock
      )
    })

    it('should handle remainder in split amounts', async () => {
      prismaMock.billingAssignment.findMany.mockResolvedValue([])
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      vi.mocked(createBillingAssignment).mockResolvedValue({} as any)

      await linkSubscriptionToProfiles(
        'sub-1',
        ['profile-1', 'profile-2', 'profile-3'],
        1000
      )

      const calls = vi.mocked(createBillingAssignment).mock.calls
      const amounts = calls.map((call) => call[0].amount)

      // Should be [333, 333, 334] - last one gets remainder
      expect(amounts).toEqual([333, 333, 334])
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(1000) // Total should equal 1000
    })

    it('should skip profiles with existing active assignments', async () => {
      prismaMock.billingAssignment.findMany.mockResolvedValue([
        { programProfileId: 'profile-1' }, // Existing assignment
      ] as any)
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      vi.mocked(createBillingAssignment).mockResolvedValue({} as any)

      const result = await linkSubscriptionToProfiles(
        'sub-1',
        ['profile-1', 'profile-2'],
        1000
      )

      // Only profile-2 should get an assignment
      expect(result).toBe(1)
      expect(createBillingAssignment).toHaveBeenCalledTimes(1)
      expect(createBillingAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          programProfileId: 'profile-2',
        }),
        prismaMock
      )
    })

    it('should include notes when provided', async () => {
      prismaMock.billingAssignment.findMany.mockResolvedValue([])
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      vi.mocked(createBillingAssignment).mockResolvedValue({} as any)

      await linkSubscriptionToProfiles(
        'sub-1',
        ['profile-1'],
        15000,
        'Family discount applied'
      )

      expect(createBillingAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Family discount applied',
        }),
        prismaMock
      )
    })
  })

  describe('unlinkSubscription', () => {
    it('should deactivate all active assignments', async () => {
      const assignments = [
        billingAssignmentFactory({ id: 'assign-1', isActive: true }),
        billingAssignmentFactory({ id: 'assign-2', isActive: true }),
        billingAssignmentFactory({ id: 'assign-3', isActive: false }), // Already inactive
      ]

      vi.mocked(getBillingAssignmentsBySubscription).mockResolvedValue(
        assignments as any
      )
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      vi.mocked(updateBillingAssignmentStatus).mockResolvedValue({} as any)

      const result = await unlinkSubscription('sub-1')

      expect(result).toBe(2) // Only 2 active assignments deactivated
      expect(updateBillingAssignmentStatus).toHaveBeenCalledTimes(2)
      expect(updateBillingAssignmentStatus).toHaveBeenCalledWith(
        'assign-1',
        false,
        expect.any(Date),
        prismaMock
      )
      expect(updateBillingAssignmentStatus).toHaveBeenCalledWith(
        'assign-2',
        false,
        expect.any(Date),
        prismaMock
      )
    })

    it('should return zero if no active assignments', async () => {
      const assignments = [
        billingAssignmentFactory({ isActive: false }),
        billingAssignmentFactory({ isActive: false }),
      ]

      vi.mocked(getBillingAssignmentsBySubscription).mockResolvedValue(
        assignments as any
      )
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })

      const result = await unlinkSubscription('sub-1')

      expect(result).toBe(0)
      expect(updateBillingAssignmentStatus).not.toHaveBeenCalled()
    })
  })

  describe('calculateSplitAmounts', () => {
    it('should throw error for zero or negative count', () => {
      expect(() => calculateSplitAmounts(1000, 0)).toThrow(
        'Count must be positive'
      )
      expect(() => calculateSplitAmounts(1000, -1)).toThrow(
        'Count must be positive'
      )
    })

    it('should return full amount for single split', () => {
      const result = calculateSplitAmounts(1000, 1)
      expect(result).toEqual([1000])
    })

    it('should split evenly when divisible', () => {
      const result = calculateSplitAmounts(1000, 2)
      expect(result).toEqual([500, 500])
    })

    it('should assign remainder to last item', () => {
      const result = calculateSplitAmounts(1000, 3)
      expect(result).toEqual([333, 333, 334])
      expect(result.reduce((a, b) => a + b, 0)).toBe(1000)
    })

    it('should handle large remainder', () => {
      const result = calculateSplitAmounts(1000, 7)
      expect(result).toEqual([142, 142, 142, 142, 142, 142, 148])
      expect(result.reduce((a, b) => a + b, 0)).toBe(1000)
    })

    it('should handle single penny splits', () => {
      const result = calculateSplitAmounts(5, 3)
      expect(result).toEqual([1, 1, 3])
      expect(result.reduce((a, b) => a + b, 0)).toBe(5)
    })
  })

  describe('getBillingStatusByEmail', () => {
    it('should throw error if person not found', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null)

      await expect(
        getBillingStatusByEmail('notfound@test.com', 'MAHAD')
      ).rejects.toThrow('Person not found with this email address')
    })

    it('should return status with no billing account', async () => {
      const person = personFactory()

      prismaMock.person.findFirst.mockResolvedValue({
        ...person,
        billingAccounts: [],
      } as any)

      const result = await getBillingStatusByEmail('test@test.com', 'MAHAD')

      expect(result.hasPaymentMethod).toBe(false)
      expect(result.hasActiveSubscription).toBe(false)
      expect(result.stripeCustomerId).toBeNull()
      expect(result.subscriptionStatus).toBeNull()
    })

    it('should return MAHAD billing status', async () => {
      const person = personFactory()
      const billingAccount = billingAccountFactory({
        stripeCustomerIdMahad: 'cus_mahad_123',
        paymentMethodCaptured: true,
      })
      const subscription = subscriptionFactory({
        status: 'active',
        paidUntil: new Date('2024-02-01'),
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      })

      prismaMock.person.findFirst.mockResolvedValue({
        ...person,
        billingAccounts: [
          {
            ...billingAccount,
            subscriptions: [subscription],
          },
        ],
      } as any)

      const result = await getBillingStatusByEmail('test@test.com', 'MAHAD')

      expect(result.hasPaymentMethod).toBe(true)
      expect(result.hasActiveSubscription).toBe(true)
      expect(result.stripeCustomerId).toBe('cus_mahad_123')
      expect(result.subscriptionStatus).toBe('active')
      expect(result.paidUntil).toEqual(new Date('2024-02-01'))
    })

    it('should return DUGSI billing status', async () => {
      const person = personFactory()
      const billingAccount = billingAccountFactory({
        stripeCustomerIdDugsi: 'cus_dugsi_123',
      })

      prismaMock.person.findFirst.mockResolvedValue({
        ...person,
        billingAccounts: [
          {
            ...billingAccount,
            subscriptions: [],
          },
        ],
      } as any)

      const result = await getBillingStatusByEmail('test@test.com', 'DUGSI')

      expect(result.stripeCustomerId).toBe('cus_dugsi_123')
    })

    it('should normalize email to lowercase', async () => {
      const person = personFactory()

      prismaMock.person.findFirst.mockResolvedValue({
        ...person,
        billingAccounts: [],
      } as any)

      await getBillingStatusByEmail('TEST@EXAMPLE.COM', 'MAHAD')

      const call = prismaMock.person.findFirst.mock.calls[0][0]
      expect(call.where.contactPoints.some.value).toBe('test@example.com')
    })
  })

  describe('getBillingStatusForProfiles', () => {
    it('should return status map for profiles with subscriptions', async () => {
      const assignment = billingAssignmentFactory({
        isActive: true,
        amount: 7500,
      })

      vi.mocked(getBillingAssignmentsByProfile).mockResolvedValue([
        assignment,
      ] as any)

      const result = await getBillingStatusForProfiles(['profile-1'])

      expect(result.size).toBe(1)
      expect(result.get('profile-1')).toEqual({
        hasSubscription: true,
        amount: 7500,
      })
    })

    it('should return status for profiles without subscriptions', async () => {
      vi.mocked(getBillingAssignmentsByProfile).mockResolvedValue([])

      const result = await getBillingStatusForProfiles(['profile-1'])

      expect(result.get('profile-1')).toEqual({
        hasSubscription: false,
        amount: null,
      })
    })

    it('should handle multiple profiles', async () => {
      vi.mocked(getBillingAssignmentsByProfile)
        .mockResolvedValueOnce([
          billingAssignmentFactory({ isActive: true, amount: 5000 }),
        ] as any)
        .mockResolvedValueOnce([])

      const result = await getBillingStatusForProfiles([
        'profile-1',
        'profile-2',
      ])

      expect(result.size).toBe(2)
      expect(result.get('profile-1')).toEqual({
        hasSubscription: true,
        amount: 5000,
      })
      expect(result.get('profile-2')).toEqual({
        hasSubscription: false,
        amount: null,
      })
    })

    it('should ignore inactive assignments', async () => {
      const inactiveAssignment = billingAssignmentFactory({
        isActive: false,
        amount: 5000,
      })

      vi.mocked(getBillingAssignmentsByProfile).mockResolvedValue([
        inactiveAssignment,
      ] as any)

      const result = await getBillingStatusForProfiles(['profile-1'])

      expect(result.get('profile-1')).toEqual({
        hasSubscription: false,
        amount: null,
      })
    })
  })
})
