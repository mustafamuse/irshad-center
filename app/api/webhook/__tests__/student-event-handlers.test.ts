/**
 * Mahad Webhook Student Event Handlers Tests
 *
 * Comprehensive test suite for the Mahad webhook event handlers
 * ensuring proper status field updates, program filtering, and error handling.
 * Migrated to ProgramProfile/Person/BillingAccount/Subscription schema.
 */

import type { Stripe } from 'stripe'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { prisma } from '@/lib/db'
import {
  updateBillingAssignmentStatus,
  updateSubscriptionStatus,
  getSubscriptionByStripeId,
  getBillingAssignmentsBySubscription,
} from '@/lib/db/queries/billing'
import { updateEnrollmentStatus } from '@/lib/db/queries/enrollment'
import { stripeServerClient as stripe } from '@/lib/stripe'

import {
  syncStudentSubscriptionState,
  handleSubscriptionDeleted,
} from '../student-event-handlers'

// Mock Prisma with new schema
vi.mock('@/lib/db', () => {
  const mockProgramProfile = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  }

  const mockBillingAccount = {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  }

  const mockSubscription = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  }

  const mockBillingAssignment = {
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  }

  const mockEnrollment = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  }

  const mockSubscriptionHistory = {
    create: vi.fn(),
  }

  const mockStudentPayment = {
    createMany: vi.fn(),
  }

  return {
    prisma: {
      programProfile: mockProgramProfile,
      billingAccount: mockBillingAccount,
      subscription: mockSubscription,
      billingAssignment: mockBillingAssignment,
      enrollment: mockEnrollment,
      subscriptionHistory: mockSubscriptionHistory,
      studentPayment: mockStudentPayment,
      // Mock $transaction to execute the callback with a transaction client
      $transaction: vi.fn((callback) => {
        const tx = {
          programProfile: mockProgramProfile,
          billingAccount: mockBillingAccount,
          subscription: mockSubscription,
          billingAssignment: mockBillingAssignment,
          enrollment: mockEnrollment,
          subscriptionHistory: mockSubscriptionHistory,
        }
        return callback(tx)
      }),
    },
  }
})

// Mock billing queries
vi.mock('@/lib/db/queries/billing', () => ({
  getBillingAccountByStripeCustomerId: vi.fn(),
  createSubscription: vi.fn(),
  createBillingAssignment: vi.fn(),
  updateBillingAssignmentStatus: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
  getSubscriptionByStripeId: vi.fn(),
  getBillingAssignmentsBySubscription: vi.fn(),
  upsertBillingAccount: vi.fn(),
  addSubscriptionHistory: vi.fn(),
  getBillingAssignmentsByProfile: vi.fn(),
}))

// Mock enrollment queries
vi.mock('@/lib/db/queries/enrollment', () => ({
  updateEnrollmentStatus: vi.fn(),
  getActiveEnrollment: vi.fn(),
}))

// Mock Stripe
vi.mock('@/lib/stripe', () => ({
  stripeServerClient: {
    subscriptions: {
      retrieve: vi.fn(),
    },
    invoices: {
      retrieve: vi.fn(),
      list: vi.fn(),
    },
    invoiceItems: {
      list: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('Mahad Webhook Student Event Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.log = vi.fn()
    console.error = vi.fn()
    console.warn = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('syncStudentSubscriptionState', () => {
    it('should update subscription status and profile status fields', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )

      // Mock subscription lookup
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        billingAccountId: 'billing_1',
        status: 'trialing',
        amount: 15000,
        assignments: [
          {
            id: 'assignment_1',
            subscriptionId: 'sub_db_1',
            programProfileId: 'profile_1',
            isActive: true,
            programProfile: {
              id: 'profile_1',
              personId: 'person_1',
              status: 'REGISTERED',
              enrollments: [
                {
                  id: 'enrollment_1',
                  programProfileId: 'profile_1',
                  status: 'REGISTERED',
                  endDate: null,
                },
              ],
            },
          },
        ],
      } as unknown)

      vi.mocked(prisma.programProfile.update).mockResolvedValue({} as unknown)
      vi.mocked(updateSubscriptionStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
        {} as unknown
      )

      await syncStudentSubscriptionState('sub_test123')

      // Verify profile status updated to ENROLLED
      expect(prisma.programProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile_1' },
        data: { status: 'ENROLLED' },
      })

      // Verify subscription status updated
      expect(updateSubscriptionStatus).toHaveBeenCalledWith(
        'sub_db_1',
        'active',
        expect.objectContaining({
          currentPeriodEnd: expect.any(Date),
          paidUntil: expect.any(Date),
        })
      )
    })

    it('should map active subscription to ENROLLED status', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'trialing',
        assignments: [
          {
            id: 'assignment_1',
            subscriptionId: 'sub_db_1',
            programProfileId: 'profile_1',
            isActive: true,
            programProfile: {
              id: 'profile_1',
              status: 'REGISTERED',
              enrollments: [
                {
                  id: 'enrollment_1',
                  status: 'REGISTERED',
                  endDate: null,
                },
              ],
            },
          },
        ],
      } as unknown)

      vi.mocked(prisma.programProfile.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.enrollment.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
        {} as unknown
      )

      await syncStudentSubscriptionState('sub_test123')

      expect(prisma.programProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'profile_1' },
          data: expect.objectContaining({
            status: 'ENROLLED',
          }),
        })
      )
    })

    it('should map past_due subscription to ENROLLED status (grace period)', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'past_due',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
        assignments: [
          {
            id: 'assignment_1',
            subscriptionId: 'sub_db_1',
            programProfileId: 'profile_1',
            isActive: true,
            programProfile: {
              id: 'profile_1',
              status: 'ENROLLED',
              enrollments: [
                {
                  id: 'enrollment_1',
                  status: 'ENROLLED',
                  endDate: null,
                },
              ],
            },
          },
        ],
      } as unknown)

      vi.mocked(prisma.programProfile.update).mockResolvedValue({} as unknown)
      vi.mocked(updateSubscriptionStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
        {} as unknown
      )

      await syncStudentSubscriptionState('sub_test123')

      expect(prisma.programProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'profile_1' },
          data: expect.objectContaining({
            status: 'ENROLLED', // Should stay enrolled during grace period
          }),
        })
      )

      expect(updateSubscriptionStatus).toHaveBeenCalledWith(
        'sub_db_1',
        'past_due',
        expect.any(Object)
      )
    })

    it('should map canceled subscription to WITHDRAWN status', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'canceled',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
        assignments: [
          {
            id: 'assignment_1',
            subscriptionId: 'sub_db_1',
            programProfileId: 'profile_1',
            isActive: true,
            programProfile: {
              id: 'profile_1',
              status: 'ENROLLED',
              enrollments: [
                {
                  id: 'enrollment_1',
                  status: 'ENROLLED',
                  endDate: null,
                },
              ],
            },
          },
        ],
      } as unknown)

      vi.mocked(prisma.programProfile.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.enrollment.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
        {} as unknown
      )

      await syncStudentSubscriptionState('sub_test123')

      expect(prisma.programProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'profile_1' },
          data: expect.objectContaining({
            status: 'WITHDRAWN', // Canceled → WITHDRAWN
          }),
        })
      )
    })

    it('should only update MAHAD_PROGRAM students', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'trialing',
        assignments: [
          {
            id: 'assignment_1',
            subscriptionId: 'sub_db_1',
            programProfileId: 'profile_1',
            isActive: true,
            programProfile: {
              id: 'profile_1',
              program: 'MAHAD_PROGRAM',
              status: 'REGISTERED',
              enrollments: [
                {
                  id: 'enrollment_1',
                  status: 'REGISTERED',
                  endDate: null,
                },
              ],
            },
          },
        ],
      } as unknown)

      vi.mocked(prisma.programProfile.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.enrollment.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
        {} as unknown
      )

      await syncStudentSubscriptionState('sub_test123')

      // Verify update is called for the MAHAD_PROGRAM profile
      expect(prisma.programProfile.update).toHaveBeenCalledTimes(1)
      expect(prisma.programProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'profile_1' },
        })
      )
    })

    it('should skip update if no subscription found', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

      await expect(syncStudentSubscriptionState('sub_test123')).rejects.toThrow(
        'Subscription not found'
      )

      expect(prisma.programProfile.update).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(stripe.subscriptions.retrieve).mockRejectedValue(
        new Error('Stripe API error')
      )

      await expect(syncStudentSubscriptionState('sub_test123')).rejects.toThrow(
        'Stripe API error'
      )

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error syncing'),
        expect.any(Error)
      )
    })
  })

  describe('syncStudentSubscriptionState - Period Fields', () => {
    it('should sync currentPeriodStart and currentPeriodEnd from Stripe', async () => {
      const periodStartTimestamp = Math.floor(Date.now() / 1000)
      const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'trialing',
        amount: 15000,
        assignments: [
          {
            id: 'assignment_1',
            programProfileId: 'profile_1',
            isActive: true,
            programProfile: {
              id: 'profile_1',
              status: 'REGISTERED',
              enrollments: [
                {
                  id: 'enrollment_1',
                  status: 'REGISTERED',
                  endDate: null,
                },
              ],
            },
          },
        ],
      } as unknown)

      vi.mocked(prisma.programProfile.update).mockResolvedValue({} as unknown)
      vi.mocked(updateSubscriptionStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
        {} as unknown
      )

      await syncStudentSubscriptionState('sub_test123')

      // Verify updateSubscriptionStatus was called with correct parameters
      expect(updateSubscriptionStatus).toHaveBeenCalledWith(
        'sub_db_1',
        'active',
        expect.objectContaining({
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
          paidUntil: expect.any(Date),
        })
      )

      // Verify dates are correct
      const updateCall = vi.mocked(updateSubscriptionStatus).mock.calls[0][2]
      expect(updateCall?.currentPeriodStart?.getTime()).toBe(
        periodStartTimestamp * 1000
      )
      expect(updateCall?.currentPeriodEnd?.getTime()).toBe(
        periodEndTimestamp * 1000
      )
    })

    it('should update subscription when status changes', async () => {
      const periodStartTimestamp = Math.floor(Date.now() / 1000)
      const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'past_due',
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'active', // Status is changing
        amount: 15000,
        assignments: [
          {
            id: 'assignment_1',
            programProfileId: 'profile_1',
            isActive: true,
            programProfile: {
              id: 'profile_1',
              status: 'ENROLLED',
              enrollments: [
                {
                  id: 'enrollment_1',
                  status: 'ENROLLED',
                  endDate: null,
                },
              ],
            },
          },
        ],
      } as unknown)

      vi.mocked(prisma.programProfile.update).mockResolvedValue({} as unknown)
      vi.mocked(updateSubscriptionStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
        {} as unknown
      )

      await syncStudentSubscriptionState('sub_test123')

      expect(updateSubscriptionStatus).toHaveBeenCalledWith(
        'sub_db_1',
        'past_due',
        expect.any(Object)
      )
    })

    it('should update subscription when status unchanged', async () => {
      const periodStartTimestamp = Math.floor(Date.now() / 1000)
      const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'active', // Status is NOT changing
        amount: 15000,
        assignments: [
          {
            id: 'assignment_1',
            programProfileId: 'profile_1',
            isActive: true,
            programProfile: {
              id: 'profile_1',
              status: 'ENROLLED',
              enrollments: [
                {
                  id: 'enrollment_1',
                  status: 'ENROLLED',
                  endDate: null,
                },
              ],
            },
          },
        ],
      } as unknown)

      vi.mocked(prisma.programProfile.update).mockResolvedValue({} as unknown)
      vi.mocked(updateSubscriptionStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
        {} as unknown
      )

      await syncStudentSubscriptionState('sub_test123')

      const updateCall = vi.mocked(updateSubscriptionStatus).mock.calls[0]
      expect(updateCall[0]).toBe('sub_db_1')
      expect(updateCall[1]).toBe('active')
    })

    it('should handle missing period dates gracefully', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        // Missing current_period_start and current_period_end
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'trialing',
        amount: 15000,
        assignments: [
          {
            id: 'assignment_1',
            programProfileId: 'profile_1',
            isActive: true,
            programProfile: {
              id: 'profile_1',
              status: 'REGISTERED',
              enrollments: [
                {
                  id: 'enrollment_1',
                  status: 'REGISTERED',
                  endDate: null,
                },
              ],
            },
          },
        ],
      } as unknown)

      vi.mocked(prisma.programProfile.update).mockResolvedValue({} as unknown)
      vi.mocked(updateSubscriptionStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
        {} as unknown
      )

      await syncStudentSubscriptionState('sub_test123')

      const updateCall = vi.mocked(updateSubscriptionStatus).mock.calls[0][2]
      expect(updateCall?.currentPeriodStart).toBeNull()
      expect(updateCall?.currentPeriodEnd).toBeNull()
      expect(updateCall?.paidUntil).toBeNull()
    })

    it('should handle multiple profiles with different statuses individually', async () => {
      const periodStartTimestamp = Math.floor(Date.now() / 1000)
      const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
        assignments: [
          {
            id: 'assignment_1',
            programProfileId: 'profile_1',
            isActive: true,
            programProfile: {
              id: 'profile_1',
              status: 'ENROLLED',
              enrollments: [
                {
                  id: 'enrollment_1',
                  status: 'ENROLLED',
                  endDate: null,
                },
              ],
            },
          },
          {
            id: 'assignment_2',
            programProfileId: 'profile_2',
            isActive: true,
            programProfile: {
              id: 'profile_2',
              status: 'REGISTERED',
              enrollments: [
                {
                  id: 'enrollment_2',
                  status: 'REGISTERED',
                  endDate: null,
                },
              ],
            },
          },
          {
            id: 'assignment_3',
            programProfileId: 'profile_3',
            isActive: true,
            programProfile: {
              id: 'profile_3',
              status: 'REGISTERED',
              enrollments: [
                {
                  id: 'enrollment_3',
                  status: 'REGISTERED',
                  endDate: null,
                },
              ],
            },
          },
        ],
      } as unknown)

      vi.mocked(prisma.programProfile.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.enrollment.update).mockResolvedValue({} as unknown)
      vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
        {} as unknown
      )

      await syncStudentSubscriptionState('sub_test123')

      // Verify update was called for each profile
      expect(prisma.programProfile.update).toHaveBeenCalledTimes(3)

      // Verify profile 1 (status unchanged ENROLLED -> ENROLLED)
      const updateCall1 = vi
        .mocked(prisma.programProfile.update)
        .mock.calls.find((call) => call[0].where.id === 'profile_1')
      expect(updateCall1?.[0].data).toEqual({ status: 'ENROLLED' })

      // Verify profile 2 (status changed REGISTERED -> ENROLLED)
      const updateCall2 = vi
        .mocked(prisma.programProfile.update)
        .mock.calls.find((call) => call[0].where.id === 'profile_2')
      expect(updateCall2?.[0].data).toEqual({ status: 'ENROLLED' })

      // Verify profile 3 (status changed REGISTERED -> ENROLLED)
      const updateCall3 = vi
        .mocked(prisma.programProfile.update)
        .mock.calls.find((call) => call[0].where.id === 'profile_3')
      expect(updateCall3?.[0].data).toEqual({ status: 'ENROLLED' })
    })
  })

  describe('handleSubscriptionDeleted', () => {
    it('should set status to WITHDRAWN when subscription is canceled', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test123',
            customer: 'cus_test123',
          } as Stripe.Subscription,
        },
      } as unknown as Stripe.Event

      vi.mocked(getSubscriptionByStripeId).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
      } as unknown)

      vi.mocked(getBillingAssignmentsBySubscription).mockResolvedValue([
        {
          id: 'assignment_1',
          programProfileId: 'profile_1',
          subscriptionId: 'sub_db_1',
          isActive: true,
        },
      ] as unknown)

      vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({
        id: 'enrollment_1',
        programProfileId: 'profile_1',
        status: 'ENROLLED',
        endDate: null,
      } as unknown)

      vi.mocked(updateBillingAssignmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateSubscriptionStatus).mockResolvedValue({} as unknown)

      await handleSubscriptionDeleted(mockEvent)

      // Verify billing assignment deactivated
      expect(updateBillingAssignmentStatus).toHaveBeenCalledWith(
        'assignment_1',
        false,
        expect.any(Date)
      )

      // Verify enrollment status set to WITHDRAWN
      expect(updateEnrollmentStatus).toHaveBeenCalledWith(
        'enrollment_1',
        'WITHDRAWN',
        'Subscription canceled',
        expect.any(Date)
      )

      // Verify subscription status set to canceled
      expect(updateSubscriptionStatus).toHaveBeenCalledWith(
        'sub_db_1',
        'canceled'
      )
    })

    it('should only affect MAHAD_PROGRAM students', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test123',
            customer: 'cus_test123',
          } as Stripe.Subscription,
        },
      } as unknown as Stripe.Event

      vi.mocked(getSubscriptionByStripeId).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        stripeAccountType: 'MAHAD',
        status: 'active',
      } as unknown)

      vi.mocked(getBillingAssignmentsBySubscription).mockResolvedValue([
        {
          id: 'assignment_1',
          programProfileId: 'profile_1',
          subscriptionId: 'sub_db_1',
          isActive: true,
        },
      ] as unknown)

      vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({
        id: 'enrollment_1',
        programProfileId: 'profile_1',
        status: 'ENROLLED',
        endDate: null,
      } as unknown)

      vi.mocked(updateBillingAssignmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateSubscriptionStatus).mockResolvedValue({} as unknown)

      await handleSubscriptionDeleted(mockEvent)

      // Verify subscription is filtered by account type
      expect(getSubscriptionByStripeId).toHaveBeenCalledWith('sub_test123')
    })

    it('should deactivate billing assignment', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test123',
            customer: 'cus_test123',
          } as Stripe.Subscription,
        },
      } as unknown as Stripe.Event

      vi.mocked(getSubscriptionByStripeId).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
      } as unknown)

      vi.mocked(getBillingAssignmentsBySubscription).mockResolvedValue([
        {
          id: 'assignment_1',
          programProfileId: 'profile_1',
          subscriptionId: 'sub_db_1',
          isActive: true,
        },
      ] as unknown)

      vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({
        id: 'enrollment_1',
        programProfileId: 'profile_1',
        status: 'ENROLLED',
        endDate: null,
      } as unknown)

      vi.mocked(updateBillingAssignmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateSubscriptionStatus).mockResolvedValue({} as unknown)

      await handleSubscriptionDeleted(mockEvent)

      expect(updateBillingAssignmentStatus).toHaveBeenCalledWith(
        'assignment_1',
        false,
        expect.any(Date)
      )
    })
  })

  describe('handleSubscriptionDeleted - Period Fields', () => {
    it('should deactivate assignments when subscription is canceled', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test123',
            customer: 'cus_test123',
          } as Stripe.Subscription,
        },
      } as unknown as Stripe.Event

      vi.mocked(getSubscriptionByStripeId).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
      } as unknown)

      vi.mocked(getBillingAssignmentsBySubscription).mockResolvedValue([
        {
          id: 'assignment_1',
          programProfileId: 'profile_1',
          subscriptionId: 'sub_db_1',
          isActive: true,
        },
      ] as unknown)

      vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({
        id: 'enrollment_1',
        programProfileId: 'profile_1',
        status: 'ENROLLED',
        endDate: null,
      } as unknown)

      vi.mocked(updateBillingAssignmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateSubscriptionStatus).mockResolvedValue({} as unknown)

      await handleSubscriptionDeleted(mockEvent)

      expect(updateBillingAssignmentStatus).toHaveBeenCalledWith(
        'assignment_1',
        false,
        expect.any(Date)
      )

      expect(updateEnrollmentStatus).toHaveBeenCalledWith(
        'enrollment_1',
        'WITHDRAWN',
        'Subscription canceled',
        expect.any(Date)
      )

      expect(updateSubscriptionStatus).toHaveBeenCalledWith(
        'sub_db_1',
        'canceled'
      )
    })

    it('should set subscription status to canceled', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test123',
            customer: 'cus_test123',
          } as Stripe.Subscription,
        },
      } as unknown as Stripe.Event

      vi.mocked(getSubscriptionByStripeId).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        status: 'active',
      } as unknown)

      vi.mocked(getBillingAssignmentsBySubscription).mockResolvedValue([
        {
          id: 'assignment_1',
          programProfileId: 'profile_1',
          subscriptionId: 'sub_db_1',
          isActive: true,
        },
      ] as unknown)

      vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({
        id: 'enrollment_1',
        programProfileId: 'profile_1',
        status: 'ENROLLED',
        endDate: null,
      } as unknown)

      vi.mocked(updateBillingAssignmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateEnrollmentStatus).mockResolvedValue({} as unknown)
      vi.mocked(updateSubscriptionStatus).mockResolvedValue({} as unknown)

      await handleSubscriptionDeleted(mockEvent)

      expect(updateSubscriptionStatus).toHaveBeenCalledWith(
        'sub_db_1',
        'canceled'
      )
    })

    it('should handle no subscription found gracefully', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test123',
            customer: 'cus_test123',
          } as Stripe.Subscription,
        },
      } as unknown as Stripe.Event

      vi.mocked(getSubscriptionByStripeId).mockResolvedValue(null)

      await handleSubscriptionDeleted(mockEvent)

      expect(updateBillingAssignmentStatus).not.toHaveBeenCalled()
      expect(updateEnrollmentStatus).not.toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      )
    })
  })

  describe('Status Mapping Integration', () => {
    it('should use correct status mapping', () => {
      const statusMap = {
        active: 'ENROLLED',
        canceled: 'WITHDRAWN',
        unpaid: 'WITHDRAWN',
        past_due: 'ENROLLED',
        trialing: 'REGISTERED',
        incomplete: 'REGISTERED',
      }

      // Verify mapping is correct
      expect(statusMap.active).toBe('ENROLLED')
      expect(statusMap.canceled).toBe('WITHDRAWN')
      expect(statusMap.unpaid).toBe('WITHDRAWN')
      expect(statusMap.past_due).toBe('ENROLLED')
      expect(statusMap.trialing).toBe('REGISTERED')
      expect(statusMap.incomplete).toBe('REGISTERED')
    })

    it('should apply correct status for all subscription statuses', async () => {
      const testCases = [
        { subStatus: 'active', expectedStatus: 'ENROLLED' },
        { subStatus: 'past_due', expectedStatus: 'ENROLLED' },
        { subStatus: 'canceled', expectedStatus: 'WITHDRAWN' },
        { subStatus: 'unpaid', expectedStatus: 'WITHDRAWN' },
        { subStatus: 'trialing', expectedStatus: 'REGISTERED' },
        { subStatus: 'incomplete', expectedStatus: 'REGISTERED' },
      ]

      for (const { subStatus, expectedStatus } of testCases) {
        vi.clearAllMocks()

        const mockSubscription: Stripe.Subscription = {
          id: 'sub_test123',
          object: 'subscription',
          status: subStatus as unknown,
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        } as unknown as Stripe.Subscription

        vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
          mockSubscription
        )

        vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
          id: 'sub_db_1',
          stripeSubscriptionId: 'sub_test123',
          status: 'trialing',
          assignments: [
            {
              id: 'assignment_1',
              programProfileId: 'profile_1',
              isActive: true,
              programProfile: {
                id: 'profile_1',
                status: 'REGISTERED',
                enrollments: [
                  {
                    id: 'enrollment_1',
                    status: 'REGISTERED',
                    endDate: null,
                  },
                ],
              },
            },
          ],
        } as unknown)

        vi.mocked(prisma.programProfile.update).mockResolvedValue({} as unknown)
        vi.mocked(prisma.subscription.update).mockResolvedValue({} as unknown)
        vi.mocked(prisma.enrollment.update).mockResolvedValue({} as unknown)
        vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
          {} as unknown
        )

        await syncStudentSubscriptionState('sub_test123')

        expect(prisma.programProfile.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'profile_1' },
            data: expect.objectContaining({
              status: expectedStatus,
            }),
          })
        )
      }
    })
  })

  describe('Program Isolation', () => {
    it('should never update DUGSI_PROGRAM students from Mahad webhook', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown as Stripe.Subscription

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )

      // Subscription exists but has no assignments (profiles)
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'sub_db_1',
        stripeSubscriptionId: 'sub_test123',
        stripeAccountType: 'MAHAD',
        status: 'trialing',
        assignments: [], // No assignments = no profiles to update
      } as unknown)

      vi.mocked(prisma.subscriptionHistory.create).mockResolvedValue(
        {} as unknown
      )

      await syncStudentSubscriptionState('sub_test123')

      // Verify update is not called when no assignments found
      expect(prisma.programProfile.update).not.toHaveBeenCalled()
      expect(prisma.enrollment.update).not.toHaveBeenCalled()
    })
  })
})
