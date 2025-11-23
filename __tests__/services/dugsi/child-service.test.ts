/**
 * Dugsi Child Service Tests
 *
 * Tests for Dugsi-specific child/student management.
 * Similar to Mahad student service but for younger students.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../utils/prisma-mock'
import {
  personFactory,
  programProfileFactory,
  guardianRelationshipFactory,
} from '../../utils/factories'
import {
  getDugsiStudent,
  getDugsiFamilyStudents,
  getDugsiStudentBillingStatus,
  getDugsiEnrollmentStatus,
  updateDugsiStudent,
} from '@/lib/services/dugsi/child-service'

describe('DugsiChildService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDugsiStudent', () => {
    it('should throw error if person not found', async () => {
      prismaMock.person.findUnique.mockResolvedValue(null)

      await expect(getDugsiStudent('non-existent')).rejects.toThrow(
        'Student not found'
      )
    })

    it('should throw error if person has no Dugsi profile', async () => {
      const person = personFactory()
      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        programProfiles: [],
        guardianRelationships: [],
      } as any)

      await expect(getDugsiStudent(person.id)).rejects.toThrow(
        'Student does not have a Dugsi profile'
      )
    })

    it('should return student with profile and guardians', async () => {
      const person = personFactory({ name: 'Ahmed Ali' })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person.id,
      })
      const guardian = personFactory({ name: 'Fatima Ali' })
      const guardianRel = guardianRelationshipFactory({
        dependentId: person.id,
        guardianId: guardian.id,
      })

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        programProfiles: [profile],
        guardianRelationships: [{ ...guardianRel, guardian }],
      } as any)

      const result = await getDugsiStudent(person.id)

      expect(result.person).toEqual(expect.objectContaining({ id: person.id }))
      expect(result.profile.program).toBe('DUGSI_PROGRAM')
      expect(result.guardians).toHaveLength(1)
      expect(result.guardians[0].name).toBe('Fatima Ali')
    })

    it('should only return active guardian relationships', async () => {
      const person = personFactory()
      const profile = programProfileFactory({ program: 'DUGSI_PROGRAM' })

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        programProfiles: [profile],
        guardianRelationships: [],
      } as any)

      const result = await getDugsiStudent(person.id)

      expect(result.guardians).toHaveLength(0)
    })
  })

  describe('getDugsiFamilyStudents', () => {
    it('should return all students with same familyReferenceId', async () => {
      const familyId = 'family-123'
      const student1 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        familyReferenceId: familyId,
      })
      const student2 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        familyReferenceId: familyId,
      })

      prismaMock.programProfile.findMany.mockResolvedValue([
        student1,
        student2,
      ] as any)

      const result = await getDugsiFamilyStudents(familyId)

      expect(result).toHaveLength(2)
      expect(prismaMock.programProfile.findMany).toHaveBeenCalledWith({
        where: {
          program: 'DUGSI_PROGRAM',
          familyReferenceId: familyId,
        },
        include: expect.any(Object),
      })
    })

    it('should exclude withdrawn enrollments', async () => {
      const familyId = 'family-123'

      prismaMock.programProfile.findMany.mockResolvedValue([])

      await getDugsiFamilyStudents(familyId)

      const call = prismaMock.programProfile.findMany.mock.calls[0][0]
      expect(call.include.enrollments.where.status).toEqual({ not: 'WITHDRAWN' })
    })
  })

  describe('getDugsiStudentBillingStatus', () => {
    it('should throw error if profile not found', async () => {
      prismaMock.programProfile.findFirst.mockResolvedValue(null)

      await expect(
        getDugsiStudentBillingStatus('non-existent')
      ).rejects.toThrow('Dugsi profile not found for student')
    })

    it('should return hasActiveSubscription:false when no assignments', async () => {
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
      })

      prismaMock.programProfile.findFirst.mockResolvedValue({
        ...profile,
        assignments: [],
      } as any)

      const result = await getDugsiStudentBillingStatus(profile.personId)

      expect(result.hasActiveSubscription).toBe(false)
      expect(result.subscriptionStatus).toBeNull()
      expect(result.subscriptionAmount).toBeNull()
    })

    it('should return subscription details when active assignment exists', async () => {
      const profile = programProfileFactory({ program: 'DUGSI_PROGRAM' })
      const subscription = {
        status: 'active',
        paidUntil: new Date('2024-02-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      }
      const billingAccount = {
        stripeCustomerIdDugsi: 'cus_123',
        paymentMethodCaptured: true,
      }
      const assignment = {
        amount: 15000,
        subscription: {
          ...subscription,
          billingAccount,
        },
      }

      prismaMock.programProfile.findFirst.mockResolvedValue({
        ...profile,
        assignments: [assignment],
      } as any)

      const result = await getDugsiStudentBillingStatus(profile.personId)

      expect(result.hasActiveSubscription).toBe(true)
      expect(result.subscriptionStatus).toBe('active')
      expect(result.subscriptionAmount).toBe(15000)
      expect(result.stripeCustomerId).toBe('cus_123')
      expect(result.paymentMethodCaptured).toBe(true)
    })
  })

  describe('getDugsiEnrollmentStatus', () => {
    it('should throw error if profile not found', async () => {
      prismaMock.programProfile.findFirst.mockResolvedValue(null)

      await expect(
        getDugsiEnrollmentStatus('non-existent')
      ).rejects.toThrow('Dugsi profile not found for student')
    })

    it('should return isEnrolled:false when no active enrollments', async () => {
      const profile = programProfileFactory({ program: 'DUGSI_PROGRAM' })

      prismaMock.programProfile.findFirst.mockResolvedValue({
        ...profile,
        enrollments: [],
      } as any)

      const result = await getDugsiEnrollmentStatus(profile.personId)

      expect(result.isEnrolled).toBe(false)
      expect(result.enrollmentStatus).toBeNull()
      expect(result.batchName).toBeNull()
    })

    it('should return enrollment details when active', async () => {
      const profile = programProfileFactory({ program: 'DUGSI_PROGRAM' })
      const enrollment = {
        status: 'ENROLLED',
        startDate: new Date('2024-01-01'),
        endDate: null,
        batch: {
          name: 'Morning Class',
        },
      }

      prismaMock.programProfile.findFirst.mockResolvedValue({
        ...profile,
        enrollments: [enrollment],
      } as any)

      const result = await getDugsiEnrollmentStatus(profile.personId)

      expect(result.isEnrolled).toBe(true)
      expect(result.enrollmentStatus).toBe('ENROLLED')
      expect(result.batchName).toBe('Morning Class')
      expect(result.startDate).toEqual(new Date('2024-01-01'))
    })
  })

  describe('updateDugsiStudent', () => {
    it('should update person name', async () => {
      const person = personFactory()

      prismaMock.person.update.mockResolvedValue({
        ...person,
        name: 'Ahmed Updated',
      } as any)

      await updateDugsiStudent(person.id, {
        name: 'Ahmed Updated',
      })

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: person.id },
        data: {
          name: 'Ahmed Updated',
          dateOfBirth: undefined,
        },
      })
    })

    it('should update person dateOfBirth', async () => {
      const person = personFactory()
      const newDate = new Date('2015-05-15')

      prismaMock.person.update.mockResolvedValue(person as any)

      await updateDugsiStudent(person.id, {
        dateOfBirth: newDate,
      })

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: person.id },
        data: {
          name: undefined,
          dateOfBirth: newDate,
        },
      })
    })

    it('should handle both name and dateOfBirth updates', async () => {
      const person = personFactory()
      const newDate = new Date('2015-05-15')

      prismaMock.person.update.mockResolvedValue(person as any)

      await updateDugsiStudent(person.id, {
        name: 'New Name',
        dateOfBirth: newDate,
      })

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: person.id },
        data: {
          name: 'New Name',
          dateOfBirth: newDate,
        },
      })
    })
  })
})
