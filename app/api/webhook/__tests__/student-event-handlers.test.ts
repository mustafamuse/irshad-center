// ⚠️ CRITICAL MIGRATION NEEDED: This test file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model
// All tests are skipped until migration is complete

/**
 * Mahad Webhook Student Event Handlers Tests
 *
 * Comprehensive test suite for the Mahad webhook event handlers
 * ensuring proper status field updates, program filtering, and error handling.
 */

import type { Stripe } from 'stripe'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { prisma } from '@/lib/db'
import { getNewStudentStatus } from '@/lib/queries/subscriptions'
import { stripeServerClient as stripe } from '@/lib/stripe'

import {
  syncStudentSubscriptionState,
  handleSubscriptionDeleted,
} from '../student-event-handlers'

// Mock Prisma
vi.mock('@/lib/db', () => {
  const mockStudent = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  }

  return {
    prisma: {
      student: mockStudent,
      studentPayment: {
        createMany: vi.fn(),
      },
      // Mock $transaction to execute the callback with a transaction client
      $transaction: vi.fn((callback) => {
        const tx = { student: mockStudent }
        return callback(tx)
      }),
    },
  }
})

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

// Mock student matcher
vi.mock('@/lib/services/student-matcher', () => ({
  studentMatcher: {
    findByCheckoutSession: vi.fn(),
    logNoMatchFound: vi.fn(),
  },
}))

describe.skip('Mahad Webhook Student Event Handlers', () => {
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
    it('should update both subscriptionStatus and status fields', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', name: 'Test Student', subscriptionStatus: null },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await syncStudentSubscriptionState('sub_test123')

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          subscriptionStatus: 'active',
          status: 'enrolled', // ✅ Verify status field is updated
          paidUntil: expect.any(Date),
        }),
      })
    })

    it('should map active subscription to enrolled status', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', subscriptionStatus: null },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await syncStudentSubscriptionState('sub_test123')

      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: expect.objectContaining({
            status: 'enrolled',
          }),
        })
      )
    })

    it('should map past_due subscription to enrolled status (grace period)', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'past_due',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', subscriptionStatus: null },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await syncStudentSubscriptionState('sub_test123')

      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: expect.objectContaining({
            subscriptionStatus: 'past_due',
            status: 'enrolled', // ✅ Should stay enrolled during grace period
          }),
        })
      )
    })

    it('should map canceled subscription to withdrawn status', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'canceled',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', subscriptionStatus: null },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await syncStudentSubscriptionState('sub_test123')

      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: expect.objectContaining({
            subscriptionStatus: 'canceled',
            status: 'withdrawn', // ✅ Canceled → withdrawn
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
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', subscriptionStatus: null },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await syncStudentSubscriptionState('sub_test123')

      // Verify program filter on findMany
      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: {
          stripeSubscriptionId: 'sub_test123',
          program: 'MAHAD_PROGRAM', // ✅ Program filter
        },
        select: {
          id: true,
          subscriptionStatus: true,
          stripeSubscriptionId: true,
        },
      })

      // Verify update is called for each student
      expect(prisma.student.update).toHaveBeenCalledTimes(1)
    })

    it('should skip update if no students found', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([])

      await syncStudentSubscriptionState('sub_test123')

      expect(prisma.student.update).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No students found')
      )
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(stripe.subscriptions.retrieve).mockRejectedValue(
        new Error('Stripe API error')
      )

      await syncStudentSubscriptionState('sub_test123')

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
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', subscriptionStatus: null },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await syncStudentSubscriptionState('sub_test123')

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          subscriptionStatus: 'active',
          status: 'enrolled',
          paidUntil: expect.any(Date),
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
        }),
      })

      // Verify dates are correct
      const updateCall = vi.mocked(prisma.student.update).mock.calls[0][0]
      expect(updateCall.data.currentPeriodStart?.getTime()).toBe(
        periodStartTimestamp * 1000
      )
      expect(updateCall.data.currentPeriodEnd?.getTime()).toBe(
        periodEndTimestamp * 1000
      )
    })

    it('should update subscriptionStatusUpdatedAt when status changes', async () => {
      const periodStartTimestamp = Math.floor(Date.now() / 1000)
      const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'past_due',
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', subscriptionStatus: 'active' }, // Status is changing
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      const beforeUpdate = Date.now()
      await syncStudentSubscriptionState('sub_test123')
      const afterUpdate = Date.now()

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          subscriptionStatus: 'past_due',
          subscriptionStatusUpdatedAt: expect.any(Date),
        }),
      })

      // Verify timestamp is recent
      const updateCall = vi.mocked(prisma.student.update).mock.calls[0][0]
      const timestamp = updateCall.data.subscriptionStatusUpdatedAt?.getTime()
      expect(timestamp).toBeGreaterThanOrEqual(beforeUpdate)
      expect(timestamp).toBeLessThanOrEqual(afterUpdate)
    })

    it('should NOT update subscriptionStatusUpdatedAt when status unchanged', async () => {
      const periodStartTimestamp = Math.floor(Date.now() / 1000)
      const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', subscriptionStatus: 'active' }, // Status is NOT changing
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await syncStudentSubscriptionState('sub_test123')

      const updateCall = vi.mocked(prisma.student.update).mock.calls[0][0]
      expect(updateCall.data).not.toHaveProperty('subscriptionStatusUpdatedAt')
    })

    it('should handle missing period dates gracefully', async () => {
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        // Missing current_period_start and current_period_end
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', subscriptionStatus: null },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await syncStudentSubscriptionState('sub_test123')

      const updateCall = vi.mocked(prisma.student.update).mock.calls[0][0]
      expect(updateCall.data.currentPeriodStart).toBeNull()
      expect(updateCall.data.currentPeriodEnd).toBeNull()
      expect(updateCall.data.paidUntil).toBeNull()
    })

    it('should handle multiple students with different statuses individually', async () => {
      const periodStartTimestamp = Math.floor(Date.now() / 1000)
      const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
      const mockSubscription: Stripe.Subscription = {
        id: 'sub_test123',
        object: 'subscription',
        status: 'active',
        current_period_start: periodStartTimestamp,
        current_period_end: periodEndTimestamp,
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', subscriptionStatus: 'active' }, // Status unchanged
        { id: '2', subscriptionStatus: 'past_due' }, // Status changing
        { id: '3', subscriptionStatus: null }, // Status changing (null -> active)
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await syncStudentSubscriptionState('sub_test123')

      // Verify update was called for each student
      expect(prisma.student.update).toHaveBeenCalledTimes(3)

      // Verify student 1 (status unchanged) - should NOT have timestamp
      const updateCall1 = vi
        .mocked(prisma.student.update)
        .mock.calls.find((call) => call[0].where.id === '1')
      expect(updateCall1?.[0].data).not.toHaveProperty(
        'subscriptionStatusUpdatedAt'
      )

      // Verify student 2 (status changed) - should HAVE timestamp
      const updateCall2 = vi
        .mocked(prisma.student.update)
        .mock.calls.find((call) => call[0].where.id === '2')
      expect(updateCall2?.[0].data).toHaveProperty(
        'subscriptionStatusUpdatedAt'
      )

      // Verify student 3 (status changed from null) - should HAVE timestamp
      const updateCall3 = vi
        .mocked(prisma.student.update)
        .mock.calls.find((call) => call[0].where.id === '3')
      expect(updateCall3?.[0].data).toHaveProperty(
        'subscriptionStatusUpdatedAt'
      )
    })
  })

  describe('handleSubscriptionDeleted', () => {
    it('should set status to withdrawn when subscription is canceled', async () => {
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
      } as unknown

      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', name: 'Test Student' },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await handleSubscriptionDeleted(mockEvent)

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: {
          id: '1',
        },
        data: expect.objectContaining({
          subscriptionStatus: 'canceled',
          status: 'withdrawn', // ✅ Verify status is set to withdrawn
          stripeSubscriptionId: null,
          paidUntil: null,
        }),
      })
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
      } as unknown

      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1' },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await handleSubscriptionDeleted(mockEvent)

      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: {
          stripeSubscriptionId: 'sub_test123',
          program: 'MAHAD_PROGRAM', // ✅ Program filter
        },
        select: {
          id: true,
        },
      })
    })

    it('should unlink subscription and clear paidUntil', async () => {
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
      } as unknown

      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1' },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await handleSubscriptionDeleted(mockEvent)

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          stripeSubscriptionId: null, // ✅ Unlink
          paidUntil: null, // ✅ Clear date
        }),
      })
    })
  })

  describe('handleSubscriptionDeleted - Period Fields', () => {
    it('should clear period fields when subscription is canceled', async () => {
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
      } as unknown

      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1' },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      await handleSubscriptionDeleted(mockEvent)

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          subscriptionStatus: 'canceled',
          status: 'withdrawn',
          currentPeriodStart: null, // ✅ Clear period fields
          currentPeriodEnd: null, // ✅ Clear period fields
          paidUntil: null,
          stripeSubscriptionId: null,
        }),
      })
    })

    it('should set subscriptionStatusUpdatedAt when canceling', async () => {
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
      } as unknown

      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1' },
      ] as unknown)
      vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

      const beforeUpdate = Date.now()
      await handleSubscriptionDeleted(mockEvent)
      const afterUpdate = Date.now()

      const updateCall = vi.mocked(prisma.student.update).mock.calls[0][0]
      expect(updateCall.data.subscriptionStatusUpdatedAt).toBeInstanceOf(Date)
      const timestamp = updateCall.data.subscriptionStatusUpdatedAt?.getTime()
      expect(timestamp).toBeGreaterThanOrEqual(beforeUpdate)
      expect(timestamp).toBeLessThanOrEqual(afterUpdate)
    })

    it('should handle no students found gracefully', async () => {
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
      } as unknown

      vi.mocked(prisma.student.findMany).mockResolvedValue([])

      await handleSubscriptionDeleted(mockEvent)

      expect(prisma.student.update).not.toHaveBeenCalled()
    })
  })

  describe('Status Mapping Integration', () => {
    it('should use getNewStudentStatus for consistent mapping', () => {
      // Test the actual mapping function
      expect(getNewStudentStatus('active')).toBe('enrolled')
      expect(getNewStudentStatus('canceled')).toBe('withdrawn')
      expect(getNewStudentStatus('unpaid')).toBe('withdrawn')
      expect(getNewStudentStatus('past_due')).toBe('enrolled')
      expect(getNewStudentStatus('trialing')).toBe('registered')
      expect(getNewStudentStatus('incomplete')).toBe('registered')
    })

    it('should apply correct status for all subscription statuses', async () => {
      const testCases = [
        { subStatus: 'active', expectedStatus: 'enrolled' },
        { subStatus: 'past_due', expectedStatus: 'enrolled' },
        { subStatus: 'canceled', expectedStatus: 'withdrawn' },
        { subStatus: 'unpaid', expectedStatus: 'withdrawn' },
        { subStatus: 'trialing', expectedStatus: 'registered' },
        { subStatus: 'incomplete', expectedStatus: 'registered' },
      ]

      for (const { subStatus, expectedStatus } of testCases) {
        vi.clearAllMocks()

        const mockSubscription: Stripe.Subscription = {
          id: 'sub_test123',
          object: 'subscription',
          status: subStatus as unknown,
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        } as unknown

        vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
          mockSubscription
        )
        vi.mocked(prisma.student.findMany).mockResolvedValue([
          { id: '1', subscriptionStatus: null },
        ] as unknown)
        vi.mocked(prisma.student.update).mockResolvedValue({} as unknown)

        await syncStudentSubscriptionState('sub_test123')

        expect(prisma.student.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: '1' },
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
      } as unknown

      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
        mockSubscription
      )
      vi.mocked(prisma.student.findMany).mockResolvedValue([])

      await syncStudentSubscriptionState('sub_test123')

      // Verify MAHAD_PROGRAM filter is always present
      const findManyCalls = vi.mocked(prisma.student.findMany).mock.calls

      findManyCalls.forEach((call) => {
        expect(call[0]?.where).toHaveProperty('program', 'MAHAD_PROGRAM')
      })

      // Verify update is not called when no students found
      expect(prisma.student.update).not.toHaveBeenCalled()
    })
  })
})
