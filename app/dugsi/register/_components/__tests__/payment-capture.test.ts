/**
 * Dugsi Payment Method Capture Tests
 *
 * Test-driven development for Dugsi $1 payment link integration.
 * These tests define the expected behavior for payment method capture
 * after successful Dugsi registration.
 */

import { prisma } from '@/lib/db'
import {
  constructDugsiPaymentUrl,
  generateFamilyId,
} from '@/lib/utils/dugsi-payment'

import { registerDugsiChildren } from '../../_actions'

// Mock data for testing
const mockFamily = (overrides = {}) => ({
  parent1FirstName: 'John',
  parent1LastName: 'Smith',
  parent1Email: 'parent@test.com',
  parent1Phone: '123-456-7890',
  isSingleParent: false,
  parent2FirstName: 'Jane',
  parent2LastName: 'Smith',
  parent2Email: 'parent2@test.com',
  parent2Phone: '098-765-4321',
  children: [
    {
      firstName: 'Alice',
      lastName: 'Smith',
      gender: 'FEMALE' as const,
      dateOfBirth: new Date('2015-01-01'),
      educationLevel: 'ELEMENTARY' as const,
      gradeLevel: 'GRADE_3' as const,
      schoolName: 'Test Elementary',
      healthInfo: 'None',
    },
    {
      firstName: 'Bob',
      lastName: 'Smith',
      gender: 'MALE' as const,
      dateOfBirth: new Date('2012-01-01'),
      educationLevel: 'ELEMENTARY' as const,
      gradeLevel: 'GRADE_6' as const,
      schoolName: 'Test Elementary',
      healthInfo: 'None',
    },
  ],
  ...overrides,
})

// Helper function to extract reference ID from payment URL
function extractReferenceId(paymentUrl: string): string {
  const url = new URL(paymentUrl)
  return url.searchParams.get('client_reference_id') || ''
}

describe('Dugsi Payment Method Capture', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.student.deleteMany({
      where: { parentEmail: { contains: 'test.com' } },
    })
  })

  describe('Registration with Payment Link', () => {
    it('should return payment URL after successful registration', async () => {
      const result = await registerDugsiChildren(mockFamily())

      expect(result.success).toBe(true)
      expect(result.data?.paymentUrl).toBeDefined()
      expect(result.data?.paymentUrl).toContain('https://buy.stripe.com/')
      expect(result.data?.familyId).toBeDefined()
    })

    it('should include parent email as prefilled_email in payment link', async () => {
      const family = mockFamily({ parent1Email: 'specific@test.com' })
      const result = await registerDugsiChildren(family)

      expect(result.success).toBe(true)
      const url = new URL(result.data!.paymentUrl)
      expect(url.searchParams.get('prefilled_email')).toBe('specific@test.com')
    })

    it('should generate unique family reference ID', async () => {
      const result1 = await registerDugsiChildren(mockFamily())
      const result2 = await registerDugsiChildren(
        mockFamily({ parent1Email: 'other@test.com' })
      )

      expect(result1.data?.familyId).not.toBe(result2.data?.familyId)
      expect(result1.data?.familyId).toMatch(/^[a-z0-9]+_smith$/)
    })

    it('should include child count in reference ID', async () => {
      const familyWith3Kids = mockFamily({
        children: [
          ...mockFamily().children,
          {
            firstName: 'Charlie',
            lastName: 'Smith',
            gender: 'MALE' as const,
            dateOfBirth: new Date('2013-01-01'),
            educationLevel: 'ELEMENTARY' as const,
            gradeLevel: 'GRADE_5' as const,
            schoolName: 'Test Elementary',
            healthInfo: 'None',
          },
        ],
      })

      const result = await registerDugsiChildren(familyWith3Kids)
      const referenceId = extractReferenceId(result.data!.paymentUrl)

      expect(referenceId).toContain('3kids')
      expect(referenceId).toMatch(/^dugsi_[^_]+_[^_]+_3kids$/)
    })

    it('should save family reference ID with all children', async () => {
      const result = await registerDugsiChildren(mockFamily())

      const children = await prisma.student.findMany({
        where: {
          parentEmail: 'parent@test.com',
          program: 'DUGSI_PROGRAM',
        },
      })

      expect(children).toHaveLength(2)
      children.forEach((child) => {
        expect(child.familyReferenceId).toBe(result.data?.familyId)
      })
    })
  })

  describe('Payment URL Construction', () => {
    it('should construct valid Stripe payment link URL', () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

      const paymentUrl = constructDugsiPaymentUrl({
        parentEmail: 'test@example.com',
        familyId: 'test_family',
        childCount: 2,
      })

      expect(paymentUrl).toContain('https://buy.stripe.com/test_abc123')
      expect(paymentUrl).toContain('prefilled_email=test%40example.com')
      expect(paymentUrl).toContain(
        'client_reference_id=dugsi_test_family_2kids'
      )
    })

    it('should throw error if payment link not configured', () => {
      delete process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI

      expect(() => {
        constructDugsiPaymentUrl({
          parentEmail: 'test@example.com',
          familyId: 'test',
          childCount: 1,
        })
      }).toThrow('Dugsi payment link not configured')
    })
  })

  describe('Family ID Generation', () => {
    it('should generate consistent family ID format', () => {
      const familyId1 = generateFamilyId('Smith')
      const familyId2 = generateFamilyId('Johnson-Williams')

      expect(familyId1).toMatch(/^[a-z0-9]+_smith$/)
      expect(familyId2).toMatch(/^[a-z0-9]+_johnsonwilliams$/)
    })

    it('should generate unique IDs even for same last name', () => {
      const id1 = generateFamilyId('Smith')
      // Small delay to ensure different timestamp
      const id2 = generateFamilyId('Smith')

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/_smith$/)
      expect(id2).toMatch(/_smith$/)
    })

    it('should handle special characters in last name', () => {
      const familyId = generateFamilyId("O'Brien-Jones III")
      expect(familyId).toMatch(/^[a-z0-9]+_obrienjones$/)
    })
  })

  describe('Registration Flow Integration', () => {
    it('should not affect existing registration without payment', async () => {
      // Test that existing flow still works when payment URL is not configured
      delete process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI

      const result = await registerDugsiChildren(mockFamily())

      expect(result.success).toBe(true)
      expect(result.data?.paymentUrl).toBeUndefined()

      // Children should still be created
      const children = await prisma.student.findMany({
        where: { parentEmail: 'parent@test.com' },
      })
      expect(children).toHaveLength(2)
    })

    it('should mark students as needing payment method capture', async () => {
      const result = await registerDugsiChildren(mockFamily())

      const children = await prisma.student.findMany({
        where: { familyReferenceId: result.data?.familyId },
      })

      children.forEach((child) => {
        expect(child.paymentMethodCaptured).toBe(false)
        expect(child.paymentMethodCapturedAt).toBeNull()
      })
    })

    it('should handle single parent registration', async () => {
      const singleParent = mockFamily({
        isSingleParent: true,
        parent2FirstName: '',
        parent2LastName: '',
        parent2Email: '',
        parent2Phone: '',
      })

      const result = await registerDugsiChildren(singleParent)

      expect(result.success).toBe(true)
      expect(result.data?.paymentUrl).toBeDefined()

      const url = new URL(result.data!.paymentUrl)
      expect(url.searchParams.get('prefilled_email')).toBe('parent@test.com')
    })
  })

  describe('Error Handling', () => {
    it('should handle duplicate child registration gracefully', async () => {
      // First registration
      await registerDugsiChildren(mockFamily())

      // Attempt duplicate registration
      const result = await registerDugsiChildren(mockFamily())

      expect(result.success).toBe(false)
      expect(result.error).toContain('Child Alice')
    })

    it('should rollback on partial failure', async () => {
      // Create first child to cause conflict
      await prisma.student.create({
        data: {
          name: 'Alice Smith',
          dateOfBirth: new Date('2015-01-01'),
          program: 'DUGSI_PROGRAM',
          parentEmail: 'different@test.com',
        },
      })

      // Try to register family with duplicate child
      const result = await registerDugsiChildren(mockFamily())

      expect(result.success).toBe(false)

      // No children should be created due to transaction rollback
      const children = await prisma.student.findMany({
        where: {
          parentEmail: 'parent@test.com',
          program: 'DUGSI_PROGRAM',
        },
      })
      expect(children).toHaveLength(0)
    })
  })
})
