/**
 * Validation Service Tests
 *
 * Tests for centralized business rule validation.
 * These tests focus on validation logic without database operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../utils/prisma-mock'
import {
  personFactory,
  programProfileFactory,
  batchFactory,
  subscriptionFactory,
} from '../utils/factories'
import {
  ValidationError,
  validateTeacherAssignment,
  validateEnrollment,
  validateGuardianRelationship,
  validateSiblingRelationship,
  validateBillingAssignment,
  validateTeacherCreation,
} from '@/lib/services/validation-service'

describe('ValidationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateTeacherAssignment', () => {
    it('should throw error if program profile not found', async () => {
      prismaMock.programProfile.findUnique.mockResolvedValue(null)

      await expect(
        validateTeacherAssignment({
          programProfileId: 'non-existent',
          teacherId: 'teacher-1',
          shift: 'MORNING',
        })
      ).rejects.toThrow(ValidationError)

      await expect(
        validateTeacherAssignment({
          programProfileId: 'non-existent',
          teacherId: 'teacher-1',
          shift: 'MORNING',
        })
      ).rejects.toThrow('Program profile not found')
    })

    it('should throw error if profile is not DUGSI_PROGRAM', async () => {
      const mahadProfile = programProfileFactory({
        program: 'MAHAD_PROGRAM',
      })

      prismaMock.programProfile.findUnique.mockResolvedValue(mahadProfile as any)

      await expect(
        validateTeacherAssignment({
          programProfileId: mahadProfile.id,
          teacherId: 'teacher-1',
          shift: 'MORNING',
        })
      ).rejects.toThrow('Teacher assignments are only allowed for Dugsi program students')
    })

    it('should throw error if teacher not found', async () => {
      const dugsiProfile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
      })

      prismaMock.programProfile.findUnique.mockResolvedValue(dugsiProfile as any)
      prismaMock.teacher.findUnique.mockResolvedValue(null)

      await expect(
        validateTeacherAssignment({
          programProfileId: dugsiProfile.id,
          teacherId: 'non-existent',
          shift: 'MORNING',
        })
      ).rejects.toThrow('Teacher not found')
    })

    it('should throw error if duplicate shift assignment exists', async () => {
      const dugsiProfile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
      })

      prismaMock.programProfile.findUnique.mockResolvedValue(dugsiProfile as any)
      prismaMock.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' } as any)
      prismaMock.teacherAssignment.findFirst.mockResolvedValue({
        id: 'existing-assignment',
        programProfileId: dugsiProfile.id,
        teacherId: 'teacher-1',
        shift: 'MORNING',
        isActive: true,
      } as any)

      await expect(
        validateTeacherAssignment({
          programProfileId: dugsiProfile.id,
          teacherId: 'teacher-1',
          shift: 'MORNING',
        })
      ).rejects.toThrow('Student already has an active MORNING shift assignment')
    })

    it('should pass validation for valid teacher assignment', async () => {
      const dugsiProfile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
      })

      prismaMock.programProfile.findUnique.mockResolvedValue(dugsiProfile as any)
      prismaMock.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' } as any)
      prismaMock.teacherAssignment.findFirst.mockResolvedValue(null)

      await expect(
        validateTeacherAssignment({
          programProfileId: dugsiProfile.id,
          teacherId: 'teacher-1',
          shift: 'MORNING',
        })
      ).resolves.not.toThrow()
    })
  })

  describe('validateEnrollment', () => {
    it('should throw error if program profile not found', async () => {
      prismaMock.programProfile.findUnique.mockResolvedValue(null)

      await expect(
        validateEnrollment({
          programProfileId: 'non-existent',
          status: 'ENROLLED',
        })
      ).rejects.toThrow('Program profile not found')
    })

    it('should throw error if Dugsi enrollment has batchId', async () => {
      const dugsiProfile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
      })

      prismaMock.programProfile.findUnique.mockResolvedValue(dugsiProfile as any)

      await expect(
        validateEnrollment({
          programProfileId: dugsiProfile.id,
          batchId: 'batch-1',
          status: 'ENROLLED',
        })
      ).rejects.toThrow('Dugsi enrollments cannot have batches')
    })

    it('should allow Dugsi enrollment without batchId', async () => {
      const dugsiProfile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
      })

      prismaMock.programProfile.findUnique.mockResolvedValue(dugsiProfile as any)

      await expect(
        validateEnrollment({
          programProfileId: dugsiProfile.id,
          batchId: null,
          status: 'ENROLLED',
        })
      ).resolves.not.toThrow()
    })

    it('should warn but allow Mahad enrollment without batchId', async () => {
      const mahadProfile = programProfileFactory({
        program: 'MAHAD_PROGRAM',
      })

      prismaMock.programProfile.findUnique.mockResolvedValue(mahadProfile as any)

      await expect(
        validateEnrollment({
          programProfileId: mahadProfile.id,
          batchId: null,
          status: 'ENROLLED',
        })
      ).resolves.not.toThrow()
    })

    it('should throw error if batch not found', async () => {
      const mahadProfile = programProfileFactory({
        program: 'MAHAD_PROGRAM',
      })

      prismaMock.programProfile.findUnique.mockResolvedValue(mahadProfile as any)
      prismaMock.batch.findUnique.mockResolvedValue(null)

      await expect(
        validateEnrollment({
          programProfileId: mahadProfile.id,
          batchId: 'non-existent',
          status: 'ENROLLED',
        })
      ).rejects.toThrow('Batch not found')
    })

    it('should pass validation for Mahad enrollment with valid batchId', async () => {
      const mahadProfile = programProfileFactory({
        program: 'MAHAD_PROGRAM',
      })
      const batch = batchFactory()

      prismaMock.programProfile.findUnique.mockResolvedValue(mahadProfile as any)
      prismaMock.batch.findUnique.mockResolvedValue(batch as any)

      await expect(
        validateEnrollment({
          programProfileId: mahadProfile.id,
          batchId: batch.id,
          status: 'ENROLLED',
        })
      ).resolves.not.toThrow()
    })

    it('should use program parameter if programProfileId not provided', async () => {
      await expect(
        validateEnrollment({
          program: 'DUGSI_PROGRAM',
          batchId: 'batch-1',
          status: 'ENROLLED',
        })
      ).rejects.toThrow('Dugsi enrollments cannot have batches')
    })

    it('should throw error if neither programProfileId nor program provided', async () => {
      await expect(
        validateEnrollment({
          status: 'ENROLLED',
        })
      ).rejects.toThrow('Either programProfileId or program must be provided')
    })
  })

  describe('validateGuardianRelationship', () => {
    it('should throw error for self-reference', async () => {
      await expect(
        validateGuardianRelationship({
          guardianId: 'person-1',
          dependentId: 'person-1',
          role: 'PARENT',
        })
      ).rejects.toThrow('A person cannot be their own guardian')
    })

    it('should throw error if guardian not found', async () => {
      prismaMock.person.findUnique.mockResolvedValueOnce(null) // guardian
      prismaMock.person.findUnique.mockResolvedValueOnce(personFactory() as any) // dependent

      await expect(
        validateGuardianRelationship({
          guardianId: 'non-existent',
          dependentId: 'person-1',
          role: 'PARENT',
        })
      ).rejects.toThrow('Guardian person not found')
    })

    it('should throw error if dependent not found', async () => {
      prismaMock.person.findUnique.mockResolvedValueOnce(personFactory() as any) // guardian
      prismaMock.person.findUnique.mockResolvedValueOnce(null) // dependent

      await expect(
        validateGuardianRelationship({
          guardianId: 'person-1',
          dependentId: 'non-existent',
          role: 'PARENT',
        })
      ).rejects.toThrow('Dependent person not found')
    })

    it('should throw error if active relationship already exists', async () => {
      const guardian = personFactory({ name: 'John Doe' })
      const dependent = personFactory({ name: 'Jane Doe' })

      prismaMock.person.findUnique.mockResolvedValueOnce(guardian as any)
      prismaMock.person.findUnique.mockResolvedValueOnce(dependent as any)
      prismaMock.guardianRelationship.findFirst.mockResolvedValue({
        id: 'existing-relationship',
        guardianId: guardian.id,
        dependentId: dependent.id,
        role: 'PARENT',
        isActive: true,
      } as any)

      await expect(
        validateGuardianRelationship({
          guardianId: guardian.id,
          dependentId: dependent.id,
          role: 'PARENT',
        })
      ).rejects.toThrow('Active PARENT relationship already exists')
    })

    it('should pass validation for valid guardian relationship', async () => {
      const guardian = personFactory()
      const dependent = personFactory()

      prismaMock.person.findUnique.mockResolvedValueOnce(guardian as any)
      prismaMock.person.findUnique.mockResolvedValueOnce(dependent as any)
      prismaMock.guardianRelationship.findFirst.mockResolvedValue(null)

      await expect(
        validateGuardianRelationship({
          guardianId: guardian.id,
          dependentId: dependent.id,
          role: 'PARENT',
        })
      ).resolves.not.toThrow()
    })
  })

  describe('validateSiblingRelationship', () => {
    it('should throw error for self-reference', async () => {
      await expect(
        validateSiblingRelationship({
          person1Id: 'person-1',
          person2Id: 'person-1',
        })
      ).rejects.toThrow('A person cannot be their own sibling')
    })

    it('should throw error if person not found', async () => {
      prismaMock.person.findUnique.mockResolvedValueOnce(null)
      prismaMock.person.findUnique.mockResolvedValueOnce(personFactory() as any)

      await expect(
        validateSiblingRelationship({
          person1Id: 'non-existent',
          person2Id: 'person-2',
        })
      ).rejects.toThrow('One or both persons not found')
    })

    it('should throw error if active relationship already exists', async () => {
      const person1 = personFactory()
      const person2 = personFactory()

      prismaMock.person.findUnique.mockResolvedValueOnce(person1 as any)
      prismaMock.person.findUnique.mockResolvedValueOnce(person2 as any)
      prismaMock.siblingRelationship.findUnique.mockResolvedValue({
        id: 'existing',
        person1Id: person1.id,
        person2Id: person2.id,
        isActive: true,
      } as any)

      await expect(
        validateSiblingRelationship({
          person1Id: person1.id,
          person2Id: person2.id,
        })
      ).rejects.toThrow('Active sibling relationship already exists')
    })

    it('should pass validation if relationship exists but is inactive', async () => {
      const person1 = personFactory()
      const person2 = personFactory()

      prismaMock.person.findUnique.mockResolvedValueOnce(person1 as any)
      prismaMock.person.findUnique.mockResolvedValueOnce(person2 as any)
      prismaMock.siblingRelationship.findUnique.mockResolvedValue({
        id: 'existing',
        person1Id: person1.id,
        person2Id: person2.id,
        isActive: false,
      } as any)

      await expect(
        validateSiblingRelationship({
          person1Id: person1.id,
          person2Id: person2.id,
        })
      ).resolves.not.toThrow()
    })

    it('should pass validation for valid sibling relationship', async () => {
      const person1 = personFactory()
      const person2 = personFactory()

      prismaMock.person.findUnique.mockResolvedValueOnce(person1 as any)
      prismaMock.person.findUnique.mockResolvedValueOnce(person2 as any)
      prismaMock.siblingRelationship.findUnique.mockResolvedValue(null)

      await expect(
        validateSiblingRelationship({
          person1Id: person1.id,
          person2Id: person2.id,
        })
      ).resolves.not.toThrow()
    })
  })

  describe('validateBillingAssignment', () => {
    it('should throw error if subscription not found', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(null)

      await expect(
        validateBillingAssignment({
          subscriptionId: 'non-existent',
          programProfileId: 'profile-1',
          amount: 15000,
        })
      ).rejects.toThrow('Subscription not found')
    })

    it('should throw error if program profile not found', async () => {
      const subscription = subscriptionFactory({ amount: 30000 })

      prismaMock.subscription.findUnique.mockResolvedValue(subscription as any)
      prismaMock.billingAssignment.findMany.mockResolvedValue([])
      prismaMock.programProfile.findUnique.mockResolvedValue(null)

      await expect(
        validateBillingAssignment({
          subscriptionId: subscription.id,
          programProfileId: 'non-existent',
          amount: 15000,
        })
      ).rejects.toThrow('Program profile not found')
    })

    it('should warn when total assignments exceed subscription amount', async () => {
      const subscription = subscriptionFactory({ amount: 30000 }) // $300

      prismaMock.subscription.findUnique.mockResolvedValue(subscription as any)
      prismaMock.billingAssignment.findMany.mockResolvedValue([
        {
          id: 'assignment-1',
          amount: 20000, // $200 already assigned
          programProfileId: 'other-profile',
        },
      ] as any)
      prismaMock.programProfile.findUnique.mockResolvedValue(
        programProfileFactory() as any
      )

      // This should warn (via logger) but not throw
      await expect(
        validateBillingAssignment({
          subscriptionId: subscription.id,
          programProfileId: 'profile-1',
          amount: 15000, // Total would be $350 > $300
        })
      ).resolves.not.toThrow()
    })

    it('should exclude current profile when calculating total (for updates)', async () => {
      const subscription = subscriptionFactory({ amount: 30000 })
      const profileId = 'profile-1'

      prismaMock.subscription.findUnique.mockResolvedValue(subscription as any)
      prismaMock.billingAssignment.findMany.mockResolvedValue([
        {
          id: 'assignment-1',
          amount: 10000,
          programProfileId: profileId, // Same profile being updated
        },
        {
          id: 'assignment-2',
          amount: 15000,
          programProfileId: 'other-profile',
        },
      ] as any)
      prismaMock.programProfile.findUnique.mockResolvedValue(
        programProfileFactory() as any
      )

      // Total = $150 (excluding current) + $100 (new) = $250 < $300
      await expect(
        validateBillingAssignment({
          subscriptionId: subscription.id,
          programProfileId: profileId,
          amount: 10000,
        })
      ).resolves.not.toThrow()
    })

    it('should pass validation for valid billing assignment', async () => {
      const subscription = subscriptionFactory({ amount: 30000 })

      prismaMock.subscription.findUnique.mockResolvedValue(subscription as any)
      prismaMock.billingAssignment.findMany.mockResolvedValue([])
      prismaMock.programProfile.findUnique.mockResolvedValue(
        programProfileFactory() as any
      )

      await expect(
        validateBillingAssignment({
          subscriptionId: subscription.id,
          programProfileId: 'profile-1',
          amount: 15000,
        })
      ).resolves.not.toThrow()
    })
  })

  describe('validateTeacherCreation', () => {
    it('should throw error if person not found', async () => {
      prismaMock.person.findUnique.mockResolvedValue(null)

      await expect(
        validateTeacherCreation({
          personId: 'non-existent',
        })
      ).rejects.toThrow('Person not found')
    })

    it('should throw error if teacher already exists for person', async () => {
      const person = personFactory({ name: 'John Teacher' })

      prismaMock.person.findUnique.mockResolvedValue(person as any)
      prismaMock.teacher.findUnique.mockResolvedValue({
        id: 'teacher-1',
        personId: person.id,
      } as any)

      await expect(
        validateTeacherCreation({
          personId: person.id,
        })
      ).rejects.toThrow('Person John Teacher is already a teacher')
    })

    it('should pass validation for new teacher', async () => {
      const person = personFactory()

      prismaMock.person.findUnique.mockResolvedValue(person as any)
      prismaMock.teacher.findUnique.mockResolvedValue(null)

      await expect(
        validateTeacherCreation({
          personId: person.id,
        })
      ).resolves.not.toThrow()
    })
  })

  describe('ValidationError', () => {
    it('should create error with code and details', () => {
      const error = new ValidationError(
        'Test error',
        'TEST_ERROR',
        { field: 'value' }
      )

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_ERROR')
      expect(error.details).toEqual({ field: 'value' })
      expect(error.name).toBe('ValidationError')
    })

    it('should work without details', () => {
      const error = new ValidationError('Test error', 'TEST_ERROR')

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_ERROR')
      expect(error.details).toBeUndefined()
    })
  })
})
