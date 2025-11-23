/**
 * Mahad Student Service Tests
 *
 * Tests for Mahad-specific student management operations.
 * Focus on business logic: student creation, updates, contact management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../utils/prisma-mock'
import {
  personFactory,
  contactPointFactory,
  programProfileFactory,
  enrollmentFactory,
  batchFactory,
} from '../../utils/factories'
import {
  createMahadStudent,
  updateMahadStudent,
  getMahadStudent,
  getMahadStudentSiblings,
  deleteMahadStudent,
} from '@/lib/services/mahad/student-service'

// Mock query dependencies
vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfileById: vi.fn(),
  createProgramProfile: vi.fn(),
}))

vi.mock('@/lib/db/queries/siblings', () => ({
  getPersonSiblings: vi.fn(),
}))

import { getProgramProfileById, createProgramProfile } from '@/lib/db/queries/program-profile'
import { getPersonSiblings } from '@/lib/db/queries/siblings'

describe('MahadStudentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createMahadStudent', () => {
    it('should normalize email to lowercase', async () => {
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })

      prismaMock.person.findFirst.mockResolvedValue(null)
      prismaMock.person.create.mockResolvedValue(personFactory() as any)
      vi.mocked(createProgramProfile).mockResolvedValue(profile as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await createMahadStudent({
        name: 'Ahmed Ali',
        email: 'AHMED@TEST.COM', // Uppercase
        monthlyRate: 150,
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactPoints: {
            create: expect.arrayContaining([
              expect.objectContaining({
                type: 'EMAIL',
                value: 'ahmed@test.com', // Lowercase
              }),
            ]),
          },
        }),
      })
    })

    it('should check for existing person by email before creating', async () => {
      const existingPerson = personFactory({ name: 'Ahmed Ali' })
      const profile = programProfileFactory({
        program: 'MAHAD_PROGRAM',
        personId: existingPerson.id,
      })

      prismaMock.person.findFirst.mockResolvedValue(existingPerson as any)
      vi.mocked(createProgramProfile).mockResolvedValue(profile as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await createMahadStudent({
        name: 'Ahmed Ali',
        email: 'ahmed@test.com',
        monthlyRate: 150,
      })

      expect(prismaMock.person.create).not.toHaveBeenCalled()
      expect(createProgramProfile).toHaveBeenCalledWith({
        personId: existingPerson.id,
        program: 'MAHAD_PROGRAM',
        educationLevel: null,
        gradeLevel: null,
        schoolName: null,
      })
    })

    it('should create person with email and phone contact points', async () => {
      const person = personFactory()
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })

      prismaMock.person.findFirst.mockResolvedValue(null)
      prismaMock.person.create.mockResolvedValue(person as any)
      vi.mocked(createProgramProfile).mockResolvedValue(profile as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await createMahadStudent({
        name: 'Ahmed Ali',
        email: 'ahmed@test.com',
        phone: '1234567890',
        monthlyRate: 150,
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          name: 'Ahmed Ali',
          dateOfBirth: null,
          contactPoints: {
            create: [
              {
                type: 'EMAIL',
                value: 'ahmed@test.com',
                isPrimary: true,
              },
              {
                type: 'PHONE',
                value: '1234567890',
              },
            ],
          },
        },
      })
    })

    it('should create program profile with education details', async () => {
      const person = personFactory()
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })

      prismaMock.person.findFirst.mockResolvedValue(null)
      prismaMock.person.create.mockResolvedValue(person as any)
      vi.mocked(createProgramProfile).mockResolvedValue(profile as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await createMahadStudent({
        name: 'Ahmed Ali',
        email: 'ahmed@test.com',
        educationLevel: 'COLLEGE',
        gradeLevel: 'FRESHMAN',
        schoolName: 'University of Minnesota',
        monthlyRate: 150,
      })

      expect(createProgramProfile).toHaveBeenCalledWith({
        personId: person.id,
        program: 'MAHAD_PROGRAM',
        educationLevel: 'COLLEGE',
        gradeLevel: 'FRESHMAN',
        schoolName: 'University of Minnesota',
      })
    })

    it('should update monthly rate if provided', async () => {
      const person = personFactory()
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })

      prismaMock.person.findFirst.mockResolvedValue(null)
      prismaMock.person.create.mockResolvedValue(person as any)
      vi.mocked(createProgramProfile).mockResolvedValue(profile as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await createMahadStudent({
        name: 'Ahmed Ali',
        email: 'ahmed@test.com',
        monthlyRate: 200,
        customRate: true,
      })

      expect(prismaMock.programProfile.update).toHaveBeenCalledWith({
        where: { id: profile.id },
        data: {
          monthlyRate: 200,
          customRate: true,
        },
      })
    })

    it('should create enrollment if batchId provided', async () => {
      const person = personFactory()
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })
      const batch = batchFactory()

      prismaMock.person.findFirst.mockResolvedValue(null)
      prismaMock.person.create.mockResolvedValue(person as any)
      vi.mocked(createProgramProfile).mockResolvedValue(profile as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)
      prismaMock.enrollment.create.mockResolvedValue({} as any)

      await createMahadStudent({
        name: 'Ahmed Ali',
        email: 'ahmed@test.com',
        batchId: batch.id,
        monthlyRate: 150,
      })

      expect(prismaMock.enrollment.create).toHaveBeenCalledWith({
        data: {
          programProfileId: profile.id,
          batchId: batch.id,
          status: 'ENROLLED',
          startDate: expect.any(Date),
        },
      })
    })

    it('should not create enrollment if batchId not provided', async () => {
      const person = personFactory()
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })

      prismaMock.person.findFirst.mockResolvedValue(null)
      prismaMock.person.create.mockResolvedValue(person as any)
      vi.mocked(createProgramProfile).mockResolvedValue(profile as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await createMahadStudent({
        name: 'Ahmed Ali',
        email: 'ahmed@test.com',
        monthlyRate: 150,
      })

      expect(prismaMock.enrollment.create).not.toHaveBeenCalled()
    })
  })

  describe('updateMahadStudent', () => {
    it('should throw error if profile not found', async () => {
      vi.mocked(getProgramProfileById).mockResolvedValue(null)

      await expect(
        updateMahadStudent('non-existent', { name: 'New Name' })
      ).rejects.toThrow('Mahad student profile not found')
    })

    it('should throw error if profile is not MAHAD_PROGRAM', async () => {
      const dugsiProfile = programProfileFactory({ program: 'DUGSI_PROGRAM' })
      vi.mocked(getProgramProfileById).mockResolvedValue(dugsiProfile as any)

      await expect(
        updateMahadStudent(dugsiProfile.id, { name: 'New Name' })
      ).rejects.toThrow('Mahad student profile not found')
    })

    it('should update person name and dateOfBirth', async () => {
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })
      const newDate = new Date('2000-01-01')

      vi.mocked(getProgramProfileById).mockResolvedValue(profile as any)
      prismaMock.person.update.mockResolvedValue(personFactory() as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await updateMahadStudent(profile.id, {
        name: 'New Name',
        dateOfBirth: newDate,
      })

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: profile.personId },
        data: {
          name: 'New Name',
          dateOfBirth: newDate,
        },
      })
    })

    it('should update existing email contact point', async () => {
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })
      const existingEmail = contactPointFactory({
        personId: profile.personId,
        type: 'EMAIL',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue(profile as any)
      prismaMock.contactPoint.findFirst.mockResolvedValue(existingEmail as any)
      prismaMock.contactPoint.update.mockResolvedValue(existingEmail as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await updateMahadStudent(profile.id, {
        email: 'NEW@TEST.COM',
      })

      expect(prismaMock.contactPoint.update).toHaveBeenCalledWith({
        where: { id: existingEmail.id },
        data: { value: 'new@test.com' },
      })
    })

    it('should create email contact point if none exists', async () => {
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })

      vi.mocked(getProgramProfileById).mockResolvedValue(profile as any)
      prismaMock.contactPoint.findFirst.mockResolvedValue(null)
      prismaMock.contactPoint.create.mockResolvedValue({} as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await updateMahadStudent(profile.id, {
        email: 'new@test.com',
      })

      expect(prismaMock.contactPoint.create).toHaveBeenCalledWith({
        data: {
          personId: profile.personId,
          type: 'EMAIL',
          value: 'new@test.com',
          isPrimary: true,
        },
      })
    })

    it('should update phone contact point', async () => {
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })
      const existingPhone = contactPointFactory({
        personId: profile.personId,
        type: 'PHONE',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue(profile as any)
      prismaMock.contactPoint.findFirst.mockResolvedValue(existingPhone as any)
      prismaMock.contactPoint.update.mockResolvedValue(existingPhone as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await updateMahadStudent(profile.id, {
        phone: '9876543210',
      })

      expect(prismaMock.contactPoint.update).toHaveBeenCalledWith({
        where: { id: existingPhone.id },
        data: { value: '9876543210' },
      })
    })

    it('should update program profile fields', async () => {
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })

      vi.mocked(getProgramProfileById).mockResolvedValue(profile as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await updateMahadStudent(profile.id, {
        educationLevel: 'COLLEGE',
        gradeLevel: 'SOPHOMORE',
        schoolName: 'UMN',
        monthlyRate: 200,
        customRate: true,
      })

      expect(prismaMock.programProfile.update).toHaveBeenCalledWith({
        where: { id: profile.id },
        data: {
          educationLevel: 'COLLEGE',
          gradeLevel: 'SOPHOMORE',
          schoolName: 'UMN',
          monthlyRate: 200,
          customRate: true,
        },
      })
    })
  })

  describe('getMahadStudent', () => {
    it('should throw error if profile not found', async () => {
      prismaMock.programProfile.findUnique.mockResolvedValue(null)

      await expect(getMahadStudent('non-existent')).rejects.toThrow(
        'Mahad student not found'
      )
    })

    it('should throw error if profile is not MAHAD_PROGRAM', async () => {
      const dugsiProfile = programProfileFactory({ program: 'DUGSI_PROGRAM' })
      prismaMock.programProfile.findUnique.mockResolvedValue(dugsiProfile as any)

      await expect(getMahadStudent(dugsiProfile.id)).rejects.toThrow(
        'Mahad student not found'
      )
    })

    it('should return student with enrollments and contact info', async () => {
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })
      const person = personFactory()
      const enrollment = enrollmentFactory()

      prismaMock.programProfile.findUnique.mockResolvedValue({
        ...profile,
        person,
        enrollments: [enrollment],
        assignments: [],
      } as any)

      const result = await getMahadStudent(profile.id)

      expect(result).toBeDefined()
      expect(prismaMock.programProfile.findUnique).toHaveBeenCalledWith({
        where: { id: profile.id },
        include: {
          person: {
            include: {
              contactPoints: true,
            },
          },
          enrollments: {
            where: {
              status: { not: 'WITHDRAWN' },
              endDate: null,
            },
            include: {
              batch: true,
            },
          },
          assignments: {
            where: { isActive: true },
            include: {
              subscription: true,
            },
          },
        },
      })
    })
  })

  describe('getMahadStudentSiblings', () => {
    it('should throw error if student not found', async () => {
      vi.mocked(getProgramProfileById).mockResolvedValue(null)

      await expect(getMahadStudentSiblings('non-existent')).rejects.toThrow(
        'Student not found'
      )
    })

    it('should return siblings for the student', async () => {
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })
      const siblings = [personFactory(), personFactory()]

      vi.mocked(getProgramProfileById).mockResolvedValue(profile as any)
      vi.mocked(getPersonSiblings).mockResolvedValue(siblings as any)

      const result = await getMahadStudentSiblings(profile.id)

      expect(result).toEqual(siblings)
      expect(getPersonSiblings).toHaveBeenCalledWith(profile.personId)
    })
  })

  describe('deleteMahadStudent', () => {
    it('should withdraw active enrollments', async () => {
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })

      prismaMock.enrollment.updateMany.mockResolvedValue({ count: 2 } as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await deleteMahadStudent(profile.id)

      expect(prismaMock.enrollment.updateMany).toHaveBeenCalledWith({
        where: {
          programProfileId: profile.id,
          status: { not: 'WITHDRAWN' },
        },
        data: {
          status: 'WITHDRAWN',
          endDate: expect.any(Date),
        },
      })
    })

    it('should mark program profile as withdrawn', async () => {
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })

      prismaMock.enrollment.updateMany.mockResolvedValue({ count: 1 } as any)
      prismaMock.programProfile.update.mockResolvedValue({
        ...profile,
        status: 'WITHDRAWN',
      } as any)

      const result = await deleteMahadStudent(profile.id)

      expect(prismaMock.programProfile.update).toHaveBeenCalledWith({
        where: { id: profile.id },
        data: {
          status: 'WITHDRAWN',
        },
      })
      expect(result.status).toBe('WITHDRAWN')
    })

    it('should handle student with no enrollments', async () => {
      const profile = programProfileFactory({ program: 'MAHAD_PROGRAM' })

      prismaMock.enrollment.updateMany.mockResolvedValue({ count: 0 } as any)
      prismaMock.programProfile.update.mockResolvedValue(profile as any)

      await deleteMahadStudent(profile.id)

      expect(prismaMock.enrollment.updateMany).toHaveBeenCalled()
      expect(prismaMock.programProfile.update).toHaveBeenCalled()
    })
  })
})
