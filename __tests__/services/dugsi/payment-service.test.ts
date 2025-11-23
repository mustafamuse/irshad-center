/**
 * Dugsi Payment Service Tests
 *
 * Tests for Dugsi payment operations.
 * Focus on bank verification, payment status retrieval, and payment link generation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../utils/prisma-mock'
import {
  personFactory,
  programProfileFactory,
  contactPointFactory,
  subscriptionFactory,
  billingAssignmentFactory,
  billingAccountFactory,
} from '../../utils/factories'
import {
  verifyBankAccount,
  getPaymentStatus,
  generatePaymentLink,
} from '@/lib/services/dugsi/payment-service'

// Mock dependencies
vi.mock('@/lib/stripe-dugsi', () => ({
  getDugsiStripeClient: vi.fn(() => ({
    paymentIntents: {
      verifyMicrodeposits: vi.fn(),
    },
  })),
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfilesByFamilyId: vi.fn(),
  getProgramProfileById: vi.fn(),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getBillingAssignmentsByProfile: vi.fn(),
}))

vi.mock('@/lib/utils/dugsi-payment', () => ({
  constructDugsiPaymentUrl: vi.fn((params) => {
    return `https://payment.link?email=${params.parentEmail}&family=${params.familyId}&count=${params.childCount}`
  }),
}))

import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import {
  getProgramProfilesByFamilyId,
  getProgramProfileById,
} from '@/lib/db/queries/program-profile'
import { getBillingAssignmentsByProfile } from '@/lib/db/queries/billing'

describe('DugsiPaymentService', () => {
  let mockStripe: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockStripe = {
      paymentIntents: {
        verifyMicrodeposits: vi.fn(),
      },
    }
    vi.mocked(getDugsiStripeClient).mockReturnValue(mockStripe)

    // Set environment variable for payment link
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI = 'test_payment_link'
  })

  describe('verifyBankAccount', () => {
    it('should verify bank account and return status', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockResolvedValue({
        id: 'pi_123456',
        status: 'succeeded',
      })

      const result = await verifyBankAccount('pi_123456', 'SMT86W')

      expect(result.paymentIntentId).toBe('pi_123456')
      expect(result.status).toBe('succeeded')
      expect(mockStripe.paymentIntents.verifyMicrodeposits).toHaveBeenCalledWith(
        'pi_123456',
        { descriptor_code: 'SMT86W' }
      )
    })

    it('should pass through Stripe API errors', async () => {
      mockStripe.paymentIntents.verifyMicrodeposits.mockRejectedValue(
        new Error('Invalid descriptor code')
      )

      await expect(
        verifyBankAccount('pi_123456', 'SMT86W')
      ).rejects.toThrow('Invalid descriptor code')
    })
  })

  describe('getPaymentStatus', () => {
    it('should throw error if family not found by email', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null)

      await expect(getPaymentStatus('notfound@test.com')).rejects.toThrow(
        'Family not found'
      )
    })

    it('should throw error if no Dugsi registrations found', async () => {
      const person = personFactory()

      prismaMock.person.findFirst.mockResolvedValue({
        ...person,
        contactPoints: [],
        programProfiles: [],
      } as any)

      await expect(getPaymentStatus('test@test.com')).rejects.toThrow(
        'No Dugsi registrations found for this email'
      )
    })

    it('should normalize email to lowercase when searching', async () => {
      const person = personFactory()
      const profile = programProfileFactory({ program: 'DUGSI_PROGRAM' })

      prismaMock.person.findFirst.mockResolvedValue({
        ...person,
        contactPoints: [],
        programProfiles: [profile],
      } as any)
      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        { ...profile, person },
      ] as any)
      vi.mocked(getBillingAssignmentsByProfile).mockResolvedValue([])

      await getPaymentStatus('TEST@EXAMPLE.COM')

      const call = prismaMock.person.findFirst.mock.calls[0][0]
      expect(call.where.contactPoints.some.value).toBe('test@example.com')
    })

    it('should return payment status with no payment method', async () => {
      const person = personFactory()
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        familyReferenceId: 'family-123',
      })

      prismaMock.person.findFirst.mockResolvedValue({
        ...person,
        contactPoints: [emailContact],
        programProfiles: [profile],
      } as any)
      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        { ...profile, person },
      ] as any)
      vi.mocked(getBillingAssignmentsByProfile).mockResolvedValue([])

      const result = await getPaymentStatus('parent@test.com')

      expect(result.familyEmail).toBe('parent@test.com')
      expect(result.studentCount).toBe(1)
      expect(result.hasPaymentMethod).toBe(false)
      expect(result.hasSubscription).toBe(false)
      expect(result.stripeCustomerId).toBeNull()
      expect(result.subscriptionStatus).toBeNull()
    })

    it('should return payment status with active subscription', async () => {
      const person = personFactory()
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        familyReferenceId: 'family-123',
      })
      const billingAccount = billingAccountFactory({
        stripeCustomerIdDugsi: 'cus_dugsi_123',
        paymentMethodCaptured: true,
      })
      const subscription = subscriptionFactory({
        status: 'active',
        stripeSubscriptionId: 'sub_123456',
        paidUntil: new Date('2024-02-01'),
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        billingAccountId: billingAccount.id,
      })
      const assignment = billingAssignmentFactory({
        isActive: true,
        subscriptionId: subscription.id,
      })

      prismaMock.person.findFirst.mockResolvedValue({
        ...person,
        contactPoints: [emailContact],
        programProfiles: [profile],
      } as any)
      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        { ...profile, person },
      ] as any)
      vi.mocked(getBillingAssignmentsByProfile).mockResolvedValue([
        {
          ...assignment,
          subscription: {
            ...subscription,
            billingAccount,
          },
        },
      ] as any)

      const result = await getPaymentStatus('parent@test.com')

      expect(result.hasPaymentMethod).toBe(true)
      expect(result.hasSubscription).toBe(true)
      expect(result.stripeCustomerId).toBe('cus_dugsi_123')
      expect(result.subscriptionId).toBe('sub_123456')
      expect(result.subscriptionStatus).toBe('active')
      expect(result.paidUntil).toEqual(new Date('2024-02-01'))
      expect(result.currentPeriodStart).toEqual(new Date('2024-01-01'))
      expect(result.currentPeriodEnd).toEqual(new Date('2024-02-01'))
    })

    it('should return student details', async () => {
      const person = personFactory({ name: 'Ahmed Ali' })
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        familyReferenceId: 'family-123',
      })

      prismaMock.person.findFirst.mockResolvedValue({
        ...person,
        contactPoints: [emailContact],
        programProfiles: [profile],
      } as any)
      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        { ...profile, person },
      ] as any)
      vi.mocked(getBillingAssignmentsByProfile).mockResolvedValue([])

      const result = await getPaymentStatus('parent@test.com')

      expect(result.students).toHaveLength(1)
      expect(result.students[0].id).toBe(profile.id)
      expect(result.students[0].name).toBe('Ahmed Ali')
    })

    it('should handle multiple children in family', async () => {
      const person = personFactory()
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const profile1 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        familyReferenceId: 'family-123',
      })
      const profile2 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        familyReferenceId: 'family-123',
      })
      const child1 = personFactory({ name: 'Child 1' })
      const child2 = personFactory({ name: 'Child 2' })

      prismaMock.person.findFirst.mockResolvedValue({
        ...person,
        contactPoints: [emailContact],
        programProfiles: [profile1],
      } as any)
      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        { ...profile1, person: child1 },
        { ...profile2, person: child2 },
      ] as any)
      vi.mocked(getBillingAssignmentsByProfile).mockResolvedValue([])

      const result = await getPaymentStatus('parent@test.com')

      expect(result.studentCount).toBe(2)
      expect(result.students).toHaveLength(2)
      expect(result.students[0].name).toBe('Child 1')
      expect(result.students[1].name).toBe('Child 2')
    })
  })

  describe('generatePaymentLink', () => {
    it('should throw error if student not found', async () => {
      vi.mocked(getProgramProfileById).mockResolvedValue(null)

      await expect(generatePaymentLink('non-existent')).rejects.toThrow(
        'Student not found'
      )
    })

    it('should throw error if familyReferenceId not found', async () => {
      const student = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
        familyReferenceId: null,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: student,
      } as any)

      await expect(generatePaymentLink(profile.id)).rejects.toThrow(
        'Family reference ID not found'
      )
    })

    it('should throw error if parent email not found', async () => {
      const student = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
        familyReferenceId: 'family-123',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          contactPoints: [], // No email
        },
      } as any)
      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        {
          ...profile,
          person: {
            ...student,
            contactPoints: [],
          },
        },
      ] as any)

      await expect(generatePaymentLink(profile.id)).rejects.toThrow(
        'Parent email is required to generate payment link'
      )
    })

    it('should throw error if payment link not configured', async () => {
      delete process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI

      const student = personFactory()
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
        familyReferenceId: 'family-123',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          contactPoints: [emailContact],
        },
      } as any)
      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        {
          ...profile,
          person: {
            ...student,
            contactPoints: [emailContact],
          },
        },
      ] as any)

      await expect(generatePaymentLink(profile.id)).rejects.toThrow(
        'Payment link not configured'
      )

      // Restore environment variable
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI = 'test_payment_link'
    })

    it('should generate payment link with correct parameters', async () => {
      const student = personFactory({ name: 'Ahmed Ali' })
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const phoneContact = contactPointFactory({
        type: 'PHONE',
        value: '1234567890',
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
        familyReferenceId: 'family-123',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          contactPoints: [emailContact, phoneContact],
        },
      } as any)
      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        {
          ...profile,
          person: {
            ...student,
            contactPoints: [emailContact, phoneContact],
          },
        },
      ] as any)

      const result = await generatePaymentLink(profile.id)

      expect(result.paymentUrl).toContain('parent@test.com')
      expect(result.paymentUrl).toContain('family-123')
      expect(result.paymentUrl).toContain('count=1')
      expect(result.parentEmail).toBe('parent@test.com')
      expect(result.parentPhone).toBe('1234567890')
      expect(result.childCount).toBe(1)
      expect(result.familyReferenceId).toBe('family-123')
    })

    it('should use provided family members instead of fetching', async () => {
      const familyMembers = [
        {
          id: 'profile-1',
          name: 'Child 1',
          parentEmail: 'parent@test.com',
          parentPhone: '1234567890',
          familyReferenceId: 'family-123',
        },
        {
          id: 'profile-2',
          name: 'Child 2',
          parentEmail: 'parent@test.com',
          parentPhone: '1234567890',
          familyReferenceId: 'family-123',
        },
      ]

      const result = await generatePaymentLink('profile-1', familyMembers as any)

      expect(result.childCount).toBe(2)
      expect(result.paymentUrl).toContain('count=2')
      expect(vi.mocked(getProgramProfileById)).not.toHaveBeenCalled()
      expect(vi.mocked(getProgramProfilesByFamilyId)).not.toHaveBeenCalled()
    })

    it('should fetch from database if provided family members is empty', async () => {
      const student = personFactory()
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
        familyReferenceId: 'family-123',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          contactPoints: [emailContact],
        },
      } as any)
      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        {
          ...profile,
          person: {
            ...student,
            contactPoints: [emailContact],
          },
        },
      ] as any)

      const result = await generatePaymentLink('profile-1', [])

      // Should fetch from database instead of using empty array
      expect(vi.mocked(getProgramProfileById)).toHaveBeenCalledWith('profile-1')
      expect(result.childCount).toBe(1)
    })

    it('should handle multiple children in family', async () => {
      const student1 = personFactory({ name: 'Child 1' })
      const student2 = personFactory({ name: 'Child 2' })
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const profile1 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student1.id,
        familyReferenceId: 'family-123',
      })
      const profile2 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student2.id,
        familyReferenceId: 'family-123',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile1,
        person: {
          ...student1,
          contactPoints: [emailContact],
        },
      } as any)
      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        {
          ...profile1,
          person: {
            ...student1,
            contactPoints: [emailContact],
          },
        },
        {
          ...profile2,
          person: {
            ...student2,
            contactPoints: [emailContact],
          },
        },
      ] as any)

      const result = await generatePaymentLink(profile1.id)

      expect(result.childCount).toBe(2)
      expect(result.paymentUrl).toContain('count=2')
    })
  })
})
