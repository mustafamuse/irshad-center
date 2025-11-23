/**
 * Dugsi Family Service Tests
 *
 * Tests for Dugsi family management operations.
 * Focus on parent updates, child management, and family operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../utils/prisma-mock'
import {
  personFactory,
  programProfileFactory,
  guardianRelationshipFactory,
  contactPointFactory,
} from '../../utils/factories'
import {
  updateParentInfo,
  addSecondParent,
  updateChildInfo,
  addChildToFamily,
} from '@/lib/services/dugsi/family-service'

// Mock dependencies
vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfileById: vi.fn(),
  getProgramProfilesByFamilyId: vi.fn(),
  findPersonByContact: vi.fn(),
}))

import {
  getProgramProfileById,
  getProgramProfilesByFamilyId,
  findPersonByContact,
} from '@/lib/db/queries/program-profile'

describe('DugsiFamilyService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateParentInfo', () => {
    it('should throw error if student not found', async () => {
      vi.mocked(getProgramProfileById).mockResolvedValue(null)

      await expect(
        updateParentInfo({
          studentId: 'non-existent',
          parentNumber: 1,
          firstName: 'John',
          lastName: 'Doe',
          phone: '1234567890',
        })
      ).rejects.toThrow('Student not found')
    })

    it('should throw error if profile is not Dugsi program', async () => {
      const mahadProfile = programProfileFactory({ program: 'MAHAD_PROGRAM' })
      vi.mocked(getProgramProfileById).mockResolvedValue(mahadProfile as any)

      await expect(
        updateParentInfo({
          studentId: mahadProfile.id,
          parentNumber: 1,
          firstName: 'John',
          lastName: 'Doe',
          phone: '1234567890',
        })
      ).rejects.toThrow('Student not found')
    })

    it('should throw error if parent not found', async () => {
      const student = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          guardianRelationships: [],
        },
      } as any)

      await expect(
        updateParentInfo({
          studentId: profile.id,
          parentNumber: 1,
          firstName: 'John',
          lastName: 'Doe',
          phone: '1234567890',
        })
      ).rejects.toThrow('Parent 1 not found')
    })

    it('should update parent name and phone when both exist', async () => {
      const student = personFactory({ name: 'Ahmed Ali' })
      const guardian = personFactory({ name: 'Fatima Ali' })
      const phoneContact = contactPointFactory({
        type: 'PHONE',
        value: '1234567890',
      })
      const guardianRel = guardianRelationshipFactory({
        dependentId: student.id,
        guardianId: guardian.id,
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          guardianRelationships: [
            {
              ...guardianRel,
              guardian: {
                ...guardian,
                contactPoints: [phoneContact],
              },
            },
          ],
        },
      } as any)

      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.person.update.mockResolvedValue(guardian as any)
      prismaMock.contactPoint.update.mockResolvedValue(phoneContact as any)

      const result = await updateParentInfo({
        studentId: profile.id,
        parentNumber: 1,
        firstName: 'Fatima',
        lastName: 'Hassan',
        phone: '9876543210',
      })

      expect(result.updated).toBe(1)
      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: guardian.id },
        data: { name: 'Fatima Hassan' },
      })
      expect(prismaMock.contactPoint.update).toHaveBeenCalledWith({
        where: { id: phoneContact.id },
        data: { value: '9876543210' },
      })
    })

    it('should create phone contact if it does not exist', async () => {
      const student = personFactory()
      const guardian = personFactory()
      const guardianRel = guardianRelationshipFactory({
        dependentId: student.id,
        guardianId: guardian.id,
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          guardianRelationships: [
            {
              ...guardianRel,
              guardian: {
                ...guardian,
                contactPoints: [], // No phone contact
              },
            },
          ],
        },
      } as any)

      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.person.update.mockResolvedValue(guardian as any)
      prismaMock.contactPoint.create.mockResolvedValue(
        contactPointFactory() as any
      )

      await updateParentInfo({
        studentId: profile.id,
        parentNumber: 1,
        firstName: 'John',
        lastName: 'Doe',
        phone: '1234567890',
      })

      expect(prismaMock.contactPoint.create).toHaveBeenCalledWith({
        data: {
          personId: guardian.id,
          type: 'PHONE',
          value: '1234567890',
        },
      })
    })

    it('should update second parent when parentNumber is 2', async () => {
      const student = personFactory()
      const guardian1 = personFactory({ name: 'Parent 1' })
      const guardian2 = personFactory({ name: 'Parent 2' })
      const phoneContact = contactPointFactory({ type: 'PHONE' })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          guardianRelationships: [
            {
              ...guardianRelationshipFactory(),
              guardian: { ...guardian1, contactPoints: [] },
            },
            {
              ...guardianRelationshipFactory(),
              guardian: { ...guardian2, contactPoints: [phoneContact] },
            },
          ],
        },
      } as any)

      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.person.update.mockResolvedValue(guardian2 as any)
      prismaMock.contactPoint.update.mockResolvedValue(phoneContact as any)

      await updateParentInfo({
        studentId: profile.id,
        parentNumber: 2,
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '5555555555',
      })

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: guardian2.id },
        data: { name: 'Jane Smith' },
      })
    })
  })

  describe('addSecondParent', () => {
    it('should throw error if student not found', async () => {
      vi.mocked(getProgramProfileById).mockResolvedValue(null)

      await expect(
        addSecondParent({
          studentId: 'non-existent',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@test.com',
          phone: '1234567890',
        })
      ).rejects.toThrow('Student not found')
    })

    it('should throw error if second parent already exists', async () => {
      const student = personFactory()
      const guardian1 = personFactory()
      const guardian2 = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          guardianRelationships: [
            { ...guardianRelationshipFactory(), guardian: guardian1 },
            { ...guardianRelationshipFactory(), guardian: guardian2 },
          ],
        },
      } as any)

      await expect(
        addSecondParent({
          studentId: profile.id,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@test.com',
          phone: '1234567890',
        })
      ).rejects.toThrow('Second parent already exists')
    })

    it('should create new person and guardian relationship if email not found', async () => {
      const student = personFactory()
      const guardian1 = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })
      const newPerson = personFactory({ name: 'Jane Doe' })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          guardianRelationships: [
            { ...guardianRelationshipFactory(), guardian: guardian1 },
          ],
        },
      } as any)
      vi.mocked(findPersonByContact).mockResolvedValue(null)

      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.person.create.mockResolvedValue(newPerson as any)
      prismaMock.guardianRelationship.create.mockResolvedValue({} as any)

      const result = await addSecondParent({
        studentId: profile.id,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'JANE@TEST.COM',
        phone: '1234567890',
      })

      expect(result.updated).toBe(1)
      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          name: 'Jane Doe',
          contactPoints: {
            create: [
              { type: 'EMAIL', value: 'jane@test.com' }, // Email normalized
              { type: 'PHONE', value: '1234567890' },
            ],
          },
        },
      })
      expect(prismaMock.guardianRelationship.create).toHaveBeenCalledWith({
        data: {
          guardianId: newPerson.id,
          dependentId: student.id,
          isActive: true,
        },
      })
    })

    it('should use existing person if email found', async () => {
      const student = personFactory()
      const guardian1 = personFactory()
      const existingPerson = personFactory({ name: 'Existing Parent' })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          guardianRelationships: [
            { ...guardianRelationshipFactory(), guardian: guardian1 },
          ],
        },
      } as any)
      vi.mocked(findPersonByContact).mockResolvedValue(existingPerson as any)

      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.guardianRelationship.create.mockResolvedValue({} as any)

      await addSecondParent({
        studentId: profile.id,
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'existing@test.com',
        phone: '1234567890',
      })

      expect(prismaMock.person.create).not.toHaveBeenCalled()
      expect(prismaMock.guardianRelationship.create).toHaveBeenCalledWith({
        data: {
          guardianId: existingPerson.id,
          dependentId: student.id,
          isActive: true,
        },
      })
    })
  })

  describe('updateChildInfo', () => {
    it('should throw error if student not found', async () => {
      vi.mocked(getProgramProfileById).mockResolvedValue(null)

      await expect(
        updateChildInfo({
          studentId: 'non-existent',
          firstName: 'Ahmed',
        })
      ).rejects.toThrow('Student not found')
    })

    it('should update person name when firstName and lastName provided', async () => {
      const student = personFactory({ name: 'Old Name' })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: student,
      } as any)
      prismaMock.person.update.mockResolvedValue(student as any)

      await updateChildInfo({
        studentId: profile.id,
        firstName: 'Ahmed',
        lastName: 'Hassan',
      })

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: student.id },
        data: { name: 'Ahmed Hassan' },
      })
    })

    it('should keep existing last name if only firstName provided', async () => {
      const student = personFactory({ name: 'Ahmed Hassan' })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: student,
      } as any)
      prismaMock.person.update.mockResolvedValue(student as any)

      await updateChildInfo({
        studentId: profile.id,
        firstName: 'Mohamed',
      })

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: student.id },
        data: { name: 'Mohamed Hassan' },
      })
    })

    it('should update dateOfBirth when provided', async () => {
      const student = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })
      const newDate = new Date('2015-05-15')

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: student,
      } as any)
      prismaMock.person.update.mockResolvedValue(student as any)

      await updateChildInfo({
        studentId: profile.id,
        dateOfBirth: newDate,
      })

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: student.id },
        data: { dateOfBirth: newDate },
      })
    })

    it('should update program profile fields', async () => {
      const student = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: student,
      } as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await updateChildInfo({
        studentId: profile.id,
        gender: 'MALE',
        educationLevel: 'ELEMENTARY',
        gradeLevel: 'THIRD',
        schoolName: 'Test School',
        healthInfo: 'No allergies',
      })

      expect(prismaMock.programProfile.update).toHaveBeenCalledWith({
        where: { id: profile.id },
        data: {
          gender: 'MALE',
          educationLevel: 'ELEMENTARY',
          gradeLevel: 'THIRD',
          schoolName: 'Test School',
          healthInfo: 'No allergies',
        },
      })
    })

    it('should not update profile if no profile fields provided', async () => {
      const student = personFactory({ name: 'Ahmed Ali' })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: student,
      } as any)
      prismaMock.person.update.mockResolvedValue(student as any)

      await updateChildInfo({
        studentId: profile.id,
        firstName: 'Mohamed',
      })

      expect(prismaMock.programProfile.update).not.toHaveBeenCalled()
    })

    it('should handle null values for optional fields', async () => {
      const student = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: student,
      } as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await updateChildInfo({
        studentId: profile.id,
        schoolName: null,
        healthInfo: null,
      })

      expect(prismaMock.programProfile.update).toHaveBeenCalledWith({
        where: { id: profile.id },
        data: {
          schoolName: null,
          healthInfo: null,
        },
      })
    })
  })

  describe('addChildToFamily', () => {
    it('should throw error if existing student not found', async () => {
      vi.mocked(getProgramProfileById).mockResolvedValue(null)

      await expect(
        addChildToFamily({
          existingStudentId: 'non-existent',
          firstName: 'New',
          lastName: 'Child',
          gender: 'MALE',
          educationLevel: 'ELEMENTARY',
          gradeLevel: 'FIRST',
        })
      ).rejects.toThrow('Existing student not found')
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

      await expect(
        addChildToFamily({
          existingStudentId: profile.id,
          firstName: 'New',
          lastName: 'Child',
          gender: 'MALE',
          educationLevel: 'ELEMENTARY',
          gradeLevel: 'FIRST',
        })
      ).rejects.toThrow('Family reference ID not found')
    })

    it('should throw error if no guardians found', async () => {
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
          guardianRelationships: [],
        },
      } as any)

      await expect(
        addChildToFamily({
          existingStudentId: profile.id,
          firstName: 'New',
          lastName: 'Child',
          gender: 'MALE',
          educationLevel: 'ELEMENTARY',
          gradeLevel: 'FIRST',
        })
      ).rejects.toThrow('No guardians found for existing student')
    })

    it('should create new child with guardian relationships', async () => {
      const student = personFactory()
      const guardian = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
        familyReferenceId: 'family-123',
      })
      const newPerson = personFactory({ name: 'New Child' })
      const newProfile = programProfileFactory({
        personId: newPerson.id,
        familyReferenceId: 'family-123',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          guardianRelationships: [
            { ...guardianRelationshipFactory(), guardian },
          ],
        },
      } as any)

      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.person.create.mockResolvedValue(newPerson as any)
      prismaMock.guardianRelationship.create.mockResolvedValue({} as any)
      prismaMock.programProfile.create.mockResolvedValue(newProfile as any)
      prismaMock.enrollment.create.mockResolvedValue({} as any)

      const result = await addChildToFamily({
        existingStudentId: profile.id,
        firstName: 'New',
        lastName: 'Child',
        gender: 'FEMALE',
        dateOfBirth: new Date('2018-01-01'),
        educationLevel: 'ELEMENTARY',
        gradeLevel: 'FIRST',
        schoolName: 'Test School',
        healthInfo: 'Allergic to peanuts',
      })

      expect(result.childId).toBe(newProfile.id)
      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          name: 'New Child',
          dateOfBirth: new Date('2018-01-01'),
        },
      })
      expect(prismaMock.guardianRelationship.create).toHaveBeenCalledWith({
        data: {
          guardianId: guardian.id,
          dependentId: newPerson.id,
          isActive: true,
        },
      })
      expect(prismaMock.programProfile.create).toHaveBeenCalledWith({
        data: {
          personId: newPerson.id,
          program: 'DUGSI_PROGRAM',
          familyReferenceId: 'family-123',
          gender: 'FEMALE',
          educationLevel: 'ELEMENTARY',
          gradeLevel: 'FIRST',
          schoolName: 'Test School',
          healthInfo: 'Allergic to peanuts',
          status: 'REGISTERED',
        },
      })
      expect(prismaMock.enrollment.create).toHaveBeenCalledWith({
        data: {
          programProfileId: newProfile.id,
          status: 'REGISTERED',
          startDate: expect.any(Date),
        },
      })
    })

    it('should create guardian relationships for multiple guardians', async () => {
      const student = personFactory()
      const guardian1 = personFactory({ name: 'Guardian 1' })
      const guardian2 = personFactory({ name: 'Guardian 2' })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: student.id,
        familyReferenceId: 'family-123',
      })
      const newPerson = personFactory()
      const newProfile = programProfileFactory()

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...student,
          guardianRelationships: [
            { ...guardianRelationshipFactory(), guardian: guardian1 },
            { ...guardianRelationshipFactory(), guardian: guardian2 },
          ],
        },
      } as any)

      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.person.create.mockResolvedValue(newPerson as any)
      prismaMock.guardianRelationship.create.mockResolvedValue({} as any)
      prismaMock.programProfile.create.mockResolvedValue(newProfile as any)
      prismaMock.enrollment.create.mockResolvedValue({} as any)

      await addChildToFamily({
        existingStudentId: profile.id,
        firstName: 'New',
        lastName: 'Child',
        gender: 'MALE',
        educationLevel: 'ELEMENTARY',
        gradeLevel: 'FIRST',
      })

      expect(prismaMock.guardianRelationship.create).toHaveBeenCalledTimes(2)
    })
  })
})
