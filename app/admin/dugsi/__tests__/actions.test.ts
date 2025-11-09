/**
 * Dugsi Server Actions Tests
 *
 * Test suite for Dugsi admin server actions
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { prisma } from '@/lib/db'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'

import {
  getDugsiRegistrations,
  getFamilyMembers,
  deleteDugsiFamily,
  linkDugsiSubscription,
  getDugsiPaymentStatus,
  updateParentInfo,
  addSecondParent,
  updateChildInfo,
  addChildToFamily,
} from '../actions'

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock Prisma
vi.mock('@/lib/db', () => {
  const mockStudent = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
  }

  return {
    prisma: {
      student: mockStudent,
      // Mock $transaction to execute the callback with a transaction client
      $transaction: vi.fn((callback) => {
        // Create a transaction client that uses the same mocks
        const tx = { student: mockStudent }
        return callback(tx)
      }),
    },
  }
})

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

  describe('updateParentInfo', () => {
    it('should update parent 1 information for entire family', async () => {
      const mockStudent = {
        id: '1',
        familyReferenceId: 'family-123',
        parentEmail: 'old@example.com',
      }

      const mockFamilyMembers = [
        { id: '1', name: 'Child 1', parentEmail: 'old@example.com' },
        { id: '2', name: 'Child 2', parentEmail: 'old@example.com' },
      ]

      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent as any)
      vi.mocked(prisma.student.updateMany).mockResolvedValue({ count: 2 })

      const result = await updateParentInfo({
        studentId: '1',
        parentNumber: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      })

      expect(prisma.student.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: {
          id: true,
          familyReferenceId: true,
          parentEmail: true,
        },
      })

      expect(prisma.student.updateMany).toHaveBeenCalledWith({
        where: {
          program: 'DUGSI_PROGRAM',
          familyReferenceId: 'family-123',
        },
        data: {
          parentFirstName: 'John',
          parentLastName: 'Doe',
          parentEmail: 'john@example.com',
          parentPhone: '+1234567890',
        },
      })

      expect(result).toEqual({
        success: true,
        data: { updated: 2 },
        message: 'Successfully updated parent information for 2 students',
      })
    })

    it('should update parent 2 information for entire family', async () => {
      const mockStudent = {
        id: '1',
        familyReferenceId: 'family-123',
        parentEmail: 'parent@example.com',
      }

      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent as any)
      vi.mocked(prisma.student.updateMany).mockResolvedValue({ count: 3 })

      const result = await updateParentInfo({
        studentId: '1',
        parentNumber: 2,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+9876543210',
      })

      expect(prisma.student.updateMany).toHaveBeenCalledWith({
        where: {
          program: 'DUGSI_PROGRAM',
          familyReferenceId: 'family-123',
        },
        data: {
          parent2FirstName: 'Jane',
          parent2LastName: 'Doe',
          parent2Email: 'jane@example.com',
          parent2Phone: '+9876543210',
        },
      })

      expect(result.success).toBe(true)
      expect(result.data?.updated).toBe(3)
    })

    it('should handle families grouped by parentEmail when no familyReferenceId', async () => {
      const mockStudent = {
        id: '1',
        familyReferenceId: null,
        parentEmail: 'parent@example.com',
      }

      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent as any)
      vi.mocked(prisma.student.updateMany).mockResolvedValue({ count: 2 })

      const result = await updateParentInfo({
        studentId: '1',
        parentNumber: 1,
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@example.com',
        phone: '+1111111111',
      })

      expect(prisma.student.updateMany).toHaveBeenCalledWith({
        where: {
          program: 'DUGSI_PROGRAM',
          parentEmail: 'parent@example.com',
          familyReferenceId: null,
        },
        data: {
          parentFirstName: 'John',
          parentLastName: 'Smith',
          parentEmail: 'john.smith@example.com',
          parentPhone: '+1111111111',
        },
      })

      expect(result.success).toBe(true)
    })

    it('should update single student when no family grouping', async () => {
      const mockStudent = {
        id: '1',
        familyReferenceId: null,
        parentEmail: null,
      }

      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent as any)
      vi.mocked(prisma.student.update).mockResolvedValue({} as any)

      const result = await updateParentInfo({
        studentId: '1',
        parentNumber: 1,
        firstName: 'Single',
        lastName: 'Parent',
        email: 'single@example.com',
        phone: '+9999999999',
      })

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          parentFirstName: 'Single',
          parentLastName: 'Parent',
          parentEmail: 'single@example.com',
          parentPhone: '+9999999999',
        },
      })

      expect(result.success).toBe(true)
      expect(result.data?.updated).toBe(1)
    })

    it('should return error if student not found', async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValue(null)

      const result = await updateParentInfo({
        studentId: 'nonexistent',
        parentNumber: 1,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+1234567890',
      })

      expect(result).toEqual({
        success: false,
        error: 'Student not found',
      })
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.student.findUnique).mockRejectedValue(
        new Error('Database error')
      )

      const result = await updateParentInfo({
        studentId: '1',
        parentNumber: 1,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+1234567890',
      })

      expect(result).toEqual({
        success: false,
        error: 'Failed to update parent information',
      })
      expect(console.error).toHaveBeenCalled()
    })

    it('should validate parentNumber is 1 or 2', async () => {
      const result = await updateParentInfo({
        studentId: '1',
        parentNumber: 3 as any,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+1234567890',
      })

      expect(result).toEqual({
        success: false,
        error: 'Parent number must be 1 or 2',
      })
    })
  })

  describe('addSecondParent', () => {
    it('should add second parent to entire family', async () => {
      const mockStudent = {
        id: '1',
        familyReferenceId: 'family-123',
        parentEmail: 'parent1@example.com',
        parent2FirstName: null,
      }

      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent as any)
      vi.mocked(prisma.student.updateMany).mockResolvedValue({ count: 2 })

      const result = await addSecondParent({
        studentId: '1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+9876543210',
      })

      expect(prisma.student.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: {
          id: true,
          familyReferenceId: true,
          parentEmail: true,
          parent2FirstName: true,
        },
      })

      expect(prisma.student.updateMany).toHaveBeenCalledWith({
        where: {
          program: 'DUGSI_PROGRAM',
          familyReferenceId: 'family-123',
        },
        data: {
          parent2FirstName: 'Jane',
          parent2LastName: 'Doe',
          parent2Email: 'jane@example.com',
          parent2Phone: '+9876543210',
        },
      })

      expect(result).toEqual({
        success: true,
        data: { updated: 2 },
        message: 'Successfully added second parent to 2 students',
      })
    })

    it('should return error if second parent already exists', async () => {
      const mockStudent = {
        id: '1',
        familyReferenceId: 'family-123',
        parentEmail: 'parent1@example.com',
        parent2FirstName: 'Existing',
      }

      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent as any)

      const result = await addSecondParent({
        studentId: '1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+9876543210',
      })

      expect(result).toEqual({
        success: false,
        error: 'Second parent already exists',
      })
    })

    it('should return error if student not found', async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValue(null)

      const result = await addSecondParent({
        studentId: 'nonexistent',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+9876543210',
      })

      expect(result).toEqual({
        success: false,
        error: 'Student not found',
      })
    })
  })

  describe('updateChildInfo', () => {
    it('should update child information', async () => {
      const mockStudent = {
        id: '1',
        name: 'Old Name',
        gender: 'MALE',
      }

      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent as any)
      vi.mocked(prisma.student.update).mockResolvedValue({
        id: '1',
        name: 'New Name',
      } as any)

      const result = await updateChildInfo({
        studentId: '1',
        name: 'New Name',
        gender: 'FEMALE',
        dateOfBirth: new Date('2015-05-15'),
        educationLevel: 'ELEMENTARY',
        gradeLevel: 'GRADE_3',
        schoolName: 'Test School',
        healthInfo: 'Allergies: None',
      })

      expect(prisma.student.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: { id: true },
      })

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          name: 'New Name',
          gender: 'FEMALE',
          dateOfBirth: new Date('2015-05-15'),
          educationLevel: 'ELEMENTARY',
          gradeLevel: 'GRADE_3',
          schoolName: 'Test School',
          healthInfo: 'Allergies: None',
        },
      })

      expect(result).toEqual({
        success: true,
        message: 'Successfully updated child information',
      })
    })

    it('should allow partial updates', async () => {
      const mockStudent = { id: '1' }

      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent as any)
      vi.mocked(prisma.student.update).mockResolvedValue({} as any)

      const result = await updateChildInfo({
        studentId: '1',
        name: 'Updated Name Only',
      })

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          name: 'Updated Name Only',
        },
      })

      expect(result.success).toBe(true)
    })

    it('should return error if student not found', async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValue(null)

      const result = await updateChildInfo({
        studentId: 'nonexistent',
        name: 'Test',
      })

      expect(result).toEqual({
        success: false,
        error: 'Student not found',
      })
    })

    it('should handle database errors', async () => {
      vi.mocked(prisma.student.findUnique).mockRejectedValue(
        new Error('Database error')
      )

      const result = await updateChildInfo({
        studentId: '1',
        name: 'Test',
      })

      expect(result).toEqual({
        success: false,
        error: 'Failed to update child information',
      })
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('addChildToFamily', () => {
    it('should add child to family by copying parent info from existing sibling', async () => {
      const mockExistingSibling = {
        id: '1',
        familyReferenceId: 'family-123',
        parentFirstName: 'John',
        parentLastName: 'Doe',
        parentEmail: 'john@example.com',
        parentPhone: '+1234567890',
        parent2FirstName: 'Jane',
        parent2LastName: 'Doe',
        parent2Email: 'jane@example.com',
        parent2Phone: '+9876543210',
      }

      vi.mocked(prisma.student.findUnique).mockResolvedValue(
        mockExistingSibling as any
      )
      vi.mocked(prisma.student.create).mockResolvedValue({
        id: 'new-child-id',
        name: 'New Child',
      } as any)

      const result = await addChildToFamily({
        existingStudentId: '1',
        name: 'New Child',
        gender: 'MALE',
        dateOfBirth: new Date('2018-03-20'),
        educationLevel: 'ELEMENTARY',
        gradeLevel: 'GRADE_1',
        schoolName: 'Test School',
        healthInfo: null,
      })

      expect(prisma.student.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: {
          id: true,
          familyReferenceId: true,
          parentFirstName: true,
          parentLastName: true,
          parentEmail: true,
          parentPhone: true,
          parent2FirstName: true,
          parent2LastName: true,
          parent2Email: true,
          parent2Phone: true,
        },
      })

      expect(prisma.student.create).toHaveBeenCalledWith({
        data: {
          name: 'New Child',
          gender: 'MALE',
          dateOfBirth: new Date('2018-03-20'),
          educationLevel: 'ELEMENTARY',
          gradeLevel: 'GRADE_1',
          schoolName: 'Test School',
          healthInfo: null,
          program: 'DUGSI_PROGRAM',
          familyReferenceId: 'family-123',
          parentFirstName: 'John',
          parentLastName: 'Doe',
          parentEmail: 'john@example.com',
          parentPhone: '+1234567890',
          parent2FirstName: 'Jane',
          parent2LastName: 'Doe',
          parent2Email: 'jane@example.com',
          parent2Phone: '+9876543210',
        },
      })

      expect(result).toEqual({
        success: true,
        data: { childId: 'new-child-id' },
        message: 'Successfully added child to family',
      })
    })

    it('should handle families without familyReferenceId', async () => {
      const mockExistingSibling = {
        id: '1',
        familyReferenceId: null,
        parentFirstName: 'John',
        parentLastName: 'Doe',
        parentEmail: 'john@example.com',
        parentPhone: '+1234567890',
        parent2FirstName: null,
        parent2LastName: null,
        parent2Email: null,
        parent2Phone: null,
      }

      vi.mocked(prisma.student.findUnique).mockResolvedValue(
        mockExistingSibling as any
      )
      vi.mocked(prisma.student.create).mockResolvedValue({
        id: 'new-child-id',
      } as any)

      const result = await addChildToFamily({
        existingStudentId: '1',
        name: 'New Child',
        gender: 'FEMALE',
        educationLevel: 'ELEMENTARY',
        gradeLevel: 'KINDERGARTEN',
      })

      expect(prisma.student.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Child',
          gender: 'FEMALE',
          familyReferenceId: null,
          parentEmail: 'john@example.com',
        }),
      })

      expect(result.success).toBe(true)
    })

    it('should return error if existing student not found', async () => {
      vi.mocked(prisma.student.findUnique).mockResolvedValue(null)

      const result = await addChildToFamily({
        existingStudentId: 'nonexistent',
        name: 'New Child',
        gender: 'MALE',
        educationLevel: 'ELEMENTARY',
        gradeLevel: 'GRADE_1',
      })

      expect(result).toEqual({
        success: false,
        error: 'Existing student not found',
      })
    })

    it('should handle database errors', async () => {
      vi.mocked(prisma.student.findUnique).mockRejectedValue(
        new Error('Database error')
      )

      const result = await addChildToFamily({
        existingStudentId: '1',
        name: 'New Child',
        gender: 'MALE',
        educationLevel: 'ELEMENTARY',
        gradeLevel: 'GRADE_1',
      })

      expect(result).toEqual({
        success: false,
        error: 'Failed to add child to family',
      })
      expect(console.error).toHaveBeenCalled()
    })
  })
})
