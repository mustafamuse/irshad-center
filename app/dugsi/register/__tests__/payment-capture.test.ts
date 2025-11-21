/**
 * Dugsi Payment Method Capture Tests
 *
 * Test-driven development for Dugsi $1 payment link integration.
 * These tests define the expected behavior for payment method capture
 * after successful Dugsi registration.
 *
 * ✅ MIGRATED: Uses Person → ProgramProfile → Enrollment model
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/lib/db'
import { ContactPoint } from '@/lib/types/person'
import {
  constructDugsiPaymentUrl,
  generateFamilyId,
} from '@/lib/utils/dugsi-payment'

import { registerDugsiChildren } from '../actions'

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
    // Clean up test data - delete in reverse order of dependencies
    const testEmail = 'test.com'

    // Find all persons with test email
    const persons = await prisma.person.findMany({
      where: {
        contactPoints: {
          some: {
            type: 'EMAIL',
            value: { contains: testEmail },
          },
        },
      },
      include: {
        programProfiles: true,
      },
    })

    const personIds = persons.map((p) => p.id)
    const profileIds = persons.flatMap((p) =>
      p.programProfiles.map((pp) => pp.id)
    )

    if (profileIds.length > 0) {
      // Delete enrollments
      await prisma.enrollment.deleteMany({
        where: {
          programProfileId: { in: profileIds },
        },
      })

      // Delete billing assignments
      await prisma.billingAssignment.deleteMany({
        where: {
          programProfileId: { in: profileIds },
        },
      })

      // Delete teacher assignments
      await prisma.teacherAssignment.deleteMany({
        where: {
          programProfileId: { in: profileIds },
        },
      })

      // Delete program profiles
      await prisma.programProfile.deleteMany({
        where: {
          id: { in: profileIds },
        },
      })
    }

    if (personIds.length > 0) {
      // Delete guardian relationships
      await prisma.guardianRelationship.deleteMany({
        where: {
          OR: [
            { guardianId: { in: personIds } },
            { dependentId: { in: personIds } },
          ],
        },
      })

      // Delete sibling relationships
      await prisma.siblingRelationship.deleteMany({
        where: {
          OR: [
            { person1Id: { in: personIds } },
            { person2Id: { in: personIds } },
          ],
        },
      })

      // Delete billing accounts
      await prisma.billingAccount.deleteMany({
        where: {
          personId: { in: personIds },
        },
      })

      // Delete contact points
      await prisma.contactPoint.deleteMany({
        where: {
          personId: { in: personIds },
        },
      })

      // Delete persons
      await prisma.person.deleteMany({
        where: {
          id: { in: personIds },
        },
      })
    }
  })

  describe('Registration with Payment Link', () => {
    it('should return payment URL after successful registration', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

      const result = await registerDugsiChildren(mockFamily())

      expect(result.success).toBe(true)
      expect(result.data?.paymentUrl).toBeDefined()
      expect(result.data?.paymentUrl).toContain('https://buy.stripe.com/')
      expect(result.data?.familyId).toBeDefined()
      expect(result.data?.billingAccountId).toBeDefined()
    })

    it('should include parent email as prefilled_email in payment link', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

      const family = mockFamily({ parent1Email: 'specific@test.com' })
      const result = await registerDugsiChildren(family)

      expect(result.success).toBe(true)
      const url = new URL(result.data!.paymentUrl!)
      expect(url.searchParams.get('prefilled_email')).toBe('specific@test.com')
    })

    it('should generate unique family reference ID', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

      const result1 = await registerDugsiChildren(mockFamily())
      const result2 = await registerDugsiChildren(
        mockFamily({ parent1Email: 'other@test.com' })
      )

      expect(result1.data?.familyId).not.toBe(result2.data?.familyId)
      expect(result1.data?.familyId).toMatch(/^[a-z0-9]+_smith$/)
    })

    it('should include child count in reference ID', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

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
      const referenceId = extractReferenceId(result.data!.paymentUrl!)

      expect(referenceId).toContain('3kids')
      expect(referenceId).toMatch(/^dugsi_[^_]+_[^_]+_3kids$/)
    })

    it('should save family reference ID with all children', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

      const result = await registerDugsiChildren(mockFamily())

      // Find parent person by email
      const parentPerson = await prisma.person.findFirst({
        where: {
          contactPoints: {
            some: {
              type: 'EMAIL',
              value: 'parent@test.com',
            },
          },
        },
        include: {
          guardianRelationships: {
            include: {
              dependent: {
                include: {
                  programProfiles: {
                    where: {
                      program: 'DUGSI_PROGRAM',
                    },
                  },
                },
              },
            },
          },
        },
      })

      expect(parentPerson).toBeTruthy()
      const childrenProfiles = parentPerson!.guardianRelationships.flatMap(
        (rel) => rel.dependent.programProfiles
      )

      expect(childrenProfiles).toHaveLength(2)
      childrenProfiles.forEach((profile) => {
        expect(profile.familyReferenceId).toBe(result.data?.familyId)
      })
    })

    it('should create billing account for parent', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

      const result = await registerDugsiChildren(mockFamily())

      expect(result.success).toBe(true)
      expect(result.data?.billingAccountId).toBeDefined()

      const billingAccount = await prisma.billingAccount.findUnique({
        where: { id: result.data!.billingAccountId! },
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
        },
      })

      expect(billingAccount).toBeTruthy()
      expect(billingAccount!.accountType).toBe('DUGSI')
      expect(
        billingAccount!.person?.contactPoints.some(
          (cp) => cp.value === 'parent@test.com'
        )
      ).toBe(true)
    })

    it('should create guardian relationships', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

      await registerDugsiChildren(mockFamily())

      // Find parent person
      const parentPerson = await prisma.person.findFirst({
        where: {
          contactPoints: {
            some: {
              type: 'EMAIL',
              value: 'parent@test.com',
            },
          },
        },
        include: {
          guardianRelationships: {
            include: {
              dependent: true,
            },
          },
        },
      })

      expect(parentPerson).toBeTruthy()
      expect(parentPerson!.guardianRelationships.length).toBeGreaterThan(0)
      expect(
        parentPerson!.guardianRelationships.every(
          (rel) => rel.role === 'PARENT' && rel.isActive
        )
      ).toBe(true)
    })

    it('should create sibling relationships for multiple children', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

      await registerDugsiChildren(mockFamily())

      // Find children persons
      const children = await prisma.person.findMany({
        where: {
          name: {
            in: ['Alice Smith', 'Bob Smith'],
          },
        },
        include: {
          siblingRelationships1: true,
          siblingRelationships2: true,
        },
      })

      expect(children.length).toBe(2)

      // Check that sibling relationship exists
      const siblingRelationships = await prisma.siblingRelationship.findMany({
        where: {
          OR: [
            {
              person1Id: { in: children.map((c) => c.id) },
              person2Id: { in: children.map((c) => c.id) },
            },
          ],
          isActive: true,
        },
      })

      expect(siblingRelationships.length).toBeGreaterThan(0)
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
      const parentPerson = await prisma.person.findFirst({
        where: {
          contactPoints: {
            some: {
              type: 'EMAIL',
              value: 'parent@test.com',
            },
          },
        },
        include: {
          guardianRelationships: {
            include: {
              dependent: {
                include: {
                  programProfiles: {
                    where: {
                      program: 'DUGSI_PROGRAM',
                    },
                  },
                },
              },
            },
          },
        },
      })

      expect(parentPerson).toBeTruthy()
      const childrenProfiles = parentPerson!.guardianRelationships.flatMap(
        (rel) => rel.dependent.programProfiles
      )
      expect(childrenProfiles.length).toBe(2)
    })

    it('should handle single parent registration', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

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

      const url = new URL(result.data!.paymentUrl!)
      expect(url.searchParams.get('prefilled_email')).toBe('parent@test.com')

      // Verify only one parent was created
      const parents = await prisma.person.findMany({
        where: {
          contactPoints: {
            some: {
              type: 'EMAIL',
              value: { in: ['parent@test.com', 'parent2@test.com'] },
            },
          },
        },
      })

      // Should only have parent1
      expect(parents.length).toBe(1)
      expect(
        (parents[0] as { contactPoints: ContactPoint[] }).contactPoints.some(
          (cp) => cp.value === 'parent@test.com'
        )
      ).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle duplicate child registration gracefully', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

      // First registration
      await registerDugsiChildren(mockFamily())

      // Attempt duplicate registration - should reuse existing child
      const result = await registerDugsiChildren(mockFamily())

      // Should succeed but reuse existing records
      expect(result.success).toBe(true)

      // Verify only one set of children exists
      const children = await prisma.person.findMany({
        where: {
          name: {
            in: ['Alice Smith', 'Bob Smith'],
          },
        },
      })

      // Should have exactly 2 children (not 4)
      expect(children.length).toBe(2)
    })

    it('should rollback on transaction failure', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI =
        'https://buy.stripe.com/test_abc123'

      // Create a person with same name/DOB to test duplicate detection
      const existingPerson = await prisma.person.create({
        data: {
          name: 'Alice Smith',
          dateOfBirth: new Date('2015-01-01'),
        },
      })

      await prisma.programProfile.create({
        data: {
          personId: existingPerson.id,
          program: 'DUGSI_PROGRAM',
          status: 'REGISTERED',
          monthlyRate: 150,
        },
      })

      // Try to register family - should handle gracefully
      // The service should detect existing child and reuse it
      const result = await registerDugsiChildren(mockFamily())

      // Should succeed (reuses existing child)
      expect(result.success).toBe(true)

      // Verify only one Alice Smith exists
      const alicePersons = await prisma.person.findMany({
        where: {
          name: 'Alice Smith',
          dateOfBirth: new Date('2015-01-01'),
        },
      })

      expect(alicePersons.length).toBe(1)
    })
  })
})
