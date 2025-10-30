/**
 * Dugsi Server Actions Tests
 *
 * Test suite for Dugsi admin server actions
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { prisma } from '@/lib/db'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'

import {
  getDugsiRegistrations,
  getFamilyMembers,
  deleteDugsiFamily,
  linkDugsiSubscription,
  getDugsiPaymentStatus,
} from '../actions'

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    student: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock Stripe Dugsi
vi.mock('@/lib/stripe-dugsi', () => ({
  getDugsiStripeClient: vi.fn().mockReturnValue({
    subscriptions: {
      retrieve: vi.fn(),
    },
  }),
}))

describe('Dugsi Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.log = vi.fn()
    console.error = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getDugsiRegistrations', () => {
    it('should fetch all Dugsi program students', async () => {
      const mockStudents = [
        {
          id: '1',
          name: 'Child 1',
          program: 'DUGSI_PROGRAM',
          parentEmail: 'parent@example.com',
          createdAt: new Date(),
        },
        {
          id: '2',
          name: 'Child 2',
          program: 'DUGSI_PROGRAM',
          parentEmail: 'parent@example.com',
          createdAt: new Date(),
        },
      ]

      vi.mocked(prisma.student.findMany).mockResolvedValue(mockStudents as any)

      const result = await getDugsiRegistrations()

      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: { program: 'DUGSI_PROGRAM' },
        orderBy: { createdAt: 'desc' },
        select: expect.objectContaining({
          id: true,
          name: true,
          parentEmail: true,
          stripeCustomerIdDugsi: true,
          stripeSubscriptionIdDugsi: true,
        }),
      })
      expect(result).toEqual(mockStudents)
    })
  })

  describe('getFamilyMembers', () => {
    it('should find siblings by phone number', async () => {
      const mockStudent = {
        id: '1',
        parentPhone: '1234567890',
        parent2Phone: '0987654321',
      }

      const mockSiblings = [
        {
          id: '1',
          name: 'Child 1',
          parentPhone: '1234567890',
        },
        {
          id: '2',
          name: 'Child 2',
          parentPhone: '1234567890',
        },
      ]

      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent as any)
      vi.mocked(prisma.student.findMany).mockResolvedValue(mockSiblings as any)

      const result = await getFamilyMembers('1')

      expect(prisma.student.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: {
          parentPhone: true,
          parent2Phone: true,
        },
      })

      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: {
          program: 'DUGSI_PROGRAM',
          OR: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { parentPhone: '1234567890' },
                { parent2Phone: '1234567890' },
              ]),
            }),
          ]),
        },
        orderBy: { createdAt: 'asc' },
        select: expect.any(Object),
      })

      expect(result).toEqual(mockSiblings)
    })

    it('should return empty array if student not found', async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValue(null)

      const result = await getFamilyMembers('nonexistent')

      expect(result).toEqual([])
    })

    it('should return empty array if no phone numbers', async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        id: '1',
        parentPhone: null,
        parent2Phone: null,
      } as any)

      const result = await getFamilyMembers('1')

      expect(result).toEqual([])
    })
  })

  describe('deleteDugsiFamily', () => {
    it('should delete entire family by phone numbers', async () => {
      const mockStudent = {
        id: '1',
        parentPhone: '1234567890',
        parent2Phone: null,
      }

      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent as any)
      vi.mocked(prisma.student.deleteMany).mockResolvedValue({ count: 2 })

      const result = await deleteDugsiFamily('1')

      expect(prisma.student.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: {
          parentPhone: true,
          parent2Phone: true,
        },
      })

      expect(prisma.student.deleteMany).toHaveBeenCalledWith({
        where: {
          program: 'DUGSI_PROGRAM',
          OR: expect.arrayContaining([
            expect.objectContaining({
              OR: [
                { parentPhone: '1234567890' },
                { parent2Phone: '1234567890' },
              ],
            }),
          ]),
        },
      })

      expect(result).toEqual({ success: true })
    })

    it('should delete single student if no phone numbers', async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValue({
        id: '1',
        parentPhone: null,
        parent2Phone: null,
      } as any)
      vi.mocked(prisma.student.delete).mockResolvedValue({ id: '1' } as any)

      const result = await deleteDugsiFamily('1')

      expect(prisma.student.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      })

      expect(result).toEqual({ success: true })
    })

    it('should handle deletion errors', async () => {
      vi.mocked(prisma.student.findUnique).mockRejectedValue(
        new Error('Database error')
      )

      const result = await deleteDugsiFamily('1')

      expect(result).toEqual({
        success: false,
        error: 'Failed to delete family',
      })
      expect(console.error).toHaveBeenCalled()
    })

    it('should return error if student not found', async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValue(null)

      const result = await deleteDugsiFamily('nonexistent')

      expect(result).toEqual({
        success: false,
        error: 'Student not found',
      })
    })
  })

  describe('linkDugsiSubscription', () => {
    it('should link subscription to family', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'active',
        customer: 'cus_test123',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{ price: { unit_amount: 15000 } }],
        },
      }

      vi.mocked(getDugsiStripeClient).mockReturnValue({
        subscriptions: {
          retrieve: vi.fn().mockResolvedValue(mockSubscription as any),
        },
      } as any)

      vi.mocked(prisma.student.findMany).mockResolvedValue([
        { id: '1', stripeSubscriptionIdDugsi: null, subscriptionStatus: null },
        { id: '2', stripeSubscriptionIdDugsi: null, subscriptionStatus: null },
      ] as any)
      vi.mocked(prisma.student.update).mockResolvedValue({} as any)

      const result = await linkDugsiSubscription({
        parentEmail: 'parent@example.com',
        subscriptionId: 'sub_test123',
      })

      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: {
          parentEmail: 'parent@example.com',
          program: 'DUGSI_PROGRAM',
        },
        select: {
          id: true,
          stripeSubscriptionIdDugsi: true,
          subscriptionStatus: true,
        },
      })

      expect(prisma.student.update).toHaveBeenCalledTimes(2)

      const updateCall = vi.mocked(prisma.student.update).mock.calls[0]
      expect(updateCall[0].data).toMatchObject({
        stripeSubscriptionIdDugsi: 'sub_test123',
        subscriptionStatus: 'active',
        stripeAccountType: 'DUGSI',
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
        paidUntil: expect.any(Date),
      })

      expect(result).toEqual({
        success: true,
        updated: 2,
        message: 'Successfully linked subscription to 2 students',
      })
    })

    it('should return error if subscription not found', async () => {
      vi.mocked(getDugsiStripeClient).mockReturnValue({
        subscriptions: {
          retrieve: vi
            .fn()
            .mockRejectedValue(new Error('Subscription not found')),
        },
      } as any)

      const result = await linkDugsiSubscription({
        parentEmail: 'parent@example.com',
        subscriptionId: 'sub_invalid',
      })

      expect(result).toEqual({
        success: false,
        error: 'Subscription not found',
      })
    })

    it('should return error if no students found', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'active',
        customer: 'cus_test123',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: {
          data: [{ price: { unit_amount: 15000 } }],
        },
      }

      vi.mocked(getDugsiStripeClient).mockReturnValue({
        subscriptions: {
          retrieve: vi.fn().mockResolvedValue(mockSubscription as any),
        },
      } as any)

      vi.mocked(prisma.student.findMany).mockResolvedValue([])

      const result = await linkDugsiSubscription({
        parentEmail: 'nonexistent@example.com',
        subscriptionId: 'sub_test123',
      })

      expect(result).toEqual({
        success: false,
        error: 'No students found with this parent email',
      })
    })

    it('should handle Stripe API errors', async () => {
      vi.mocked(getDugsiStripeClient).mockReturnValue({
        subscriptions: {
          retrieve: vi.fn().mockRejectedValue(new Error('Stripe API error')),
        },
      } as any)

      const result = await linkDugsiSubscription({
        parentEmail: 'parent@example.com',
        subscriptionId: 'sub_test123',
      })

      expect(result).toEqual({
        success: false,
        error: 'Stripe API error',
      })
      expect(console.error).toHaveBeenCalled()
    })

    it('should return error if parentEmail is null or empty', async () => {
      // Test with empty string
      const resultEmpty = await linkDugsiSubscription({
        parentEmail: '',
        subscriptionId: 'sub_test123',
      })

      expect(resultEmpty).toEqual({
        success: false,
        error:
          'Parent email is required to link subscription. Please update the student record with a parent email first.',
      })

      // Test with whitespace only
      const resultWhitespace = await linkDugsiSubscription({
        parentEmail: '   ',
        subscriptionId: 'sub_test123',
      })

      expect(resultWhitespace).toEqual({
        success: false,
        error:
          'Parent email is required to link subscription. Please update the student record with a parent email first.',
      })

      // Verify Stripe API was never called
      expect(getDugsiStripeClient).not.toHaveBeenCalled()
    })
  })

  describe('getDugsiPaymentStatus', () => {
    it('should return payment status for family', async () => {
      const mockStudents = [
        {
          id: '1',
          name: 'Child 1',
          paymentMethodCaptured: true,
          stripeCustomerIdDugsi: 'cus_test123',
          stripeSubscriptionIdDugsi: 'sub_test123',
          subscriptionStatus: 'active',
          paidUntil: new Date('2025-01-01'),
        },
        {
          id: '2',
          name: 'Child 2',
          paymentMethodCaptured: true,
          stripeCustomerIdDugsi: 'cus_test123',
          stripeSubscriptionIdDugsi: 'sub_test123',
          subscriptionStatus: 'active',
          paidUntil: new Date('2025-01-01'),
        },
      ]

      vi.mocked(prisma.student.findMany).mockResolvedValue(mockStudents as any)

      const result = await getDugsiPaymentStatus('parent@example.com')

      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: {
          parentEmail: 'parent@example.com',
          program: 'DUGSI_PROGRAM',
        },
        select: expect.objectContaining({
          id: true,
          name: true,
          paymentMethodCaptured: true,
          stripeCustomerIdDugsi: true,
          stripeSubscriptionIdDugsi: true,
        }),
      })

      expect(result).toEqual({
        success: true,
        data: {
          familyEmail: 'parent@example.com',
          studentCount: 2,
          hasPaymentMethod: true,
          hasSubscription: true,
          stripeCustomerId: 'cus_test123',
          subscriptionId: 'sub_test123',
          subscriptionStatus: 'active',
          paidUntil: new Date('2025-01-01'),
          students: [
            { id: '1', name: 'Child 1' },
            { id: '2', name: 'Child 2' },
          ],
        },
      })
    })

    it('should return error if no students found', async () => {
      vi.mocked(prisma.student.findMany).mockResolvedValue([])

      const result = await getDugsiPaymentStatus('nonexistent@example.com')

      expect(result).toEqual({
        success: false,
        error: 'No students found for this email',
      })
    })

    it('should handle database errors', async () => {
      vi.mocked(prisma.student.findMany).mockRejectedValue(
        new Error('Database error')
      )

      const result = await getDugsiPaymentStatus('parent@example.com')

      expect(result).toEqual({
        success: false,
        error: 'Failed to get payment status',
      })
      expect(console.error).toHaveBeenCalled()
    })

    it('should detect when no payment method is captured', async () => {
      const mockStudents = [
        {
          id: '1',
          name: 'Child 1',
          paymentMethodCaptured: false,
          stripeCustomerIdDugsi: null,
          stripeSubscriptionIdDugsi: null,
          subscriptionStatus: null,
          paidUntil: null,
        },
      ]

      vi.mocked(prisma.student.findMany).mockResolvedValue(mockStudents as any)

      const result = await getDugsiPaymentStatus('parent@example.com')

      expect(result.success).toBe(true)
      expect(result.data?.hasPaymentMethod).toBe(false)
      expect(result.data?.hasSubscription).toBe(false)
    })
  })
})
