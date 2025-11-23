/**
 * Dugsi Registration Service Tests
 *
 * Tests for Dugsi registration management operations.
 * Focus on fetching, mapping, and deletion logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../utils/prisma-mock'
import {
  personFactory,
  programProfileFactory,
  contactPointFactory,
} from '../../utils/factories'
import {
  getAllDugsiRegistrations,
  getFamilyMembers,
  getDeleteFamilyPreview,
  deleteDugsiFamily,
  searchDugsiRegistrationsByContact,
} from '@/lib/services/dugsi/registration-service'

// Mock dependencies
vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfileById: vi.fn(),
  getProgramProfilesByFamilyId: vi.fn(),
}))

vi.mock('@/lib/mappers/dugsi-mapper', () => ({
  mapProfileToDugsiRegistration: vi.fn((profile) => {
    if (!profile) return null
    return {
      id: profile.id,
      name: profile.person?.name || 'Unknown',
      parentEmail: profile.person?.contactPoints?.find((cp: any) => cp.type === 'EMAIL')
        ?.value || null,
      familyReferenceId: profile.familyReferenceId,
    }
  }),
}))

import {
  getProgramProfileById,
  getProgramProfilesByFamilyId,
} from '@/lib/db/queries/program-profile'
import { mapProfileToDugsiRegistration } from '@/lib/mappers/dugsi-mapper'

describe('DugsiRegistrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllDugsiRegistrations', () => {
    it('should return all Dugsi registrations', async () => {
      const person1 = personFactory({ name: 'Child 1' })
      const person2 = personFactory({ name: 'Child 2' })
      const profile1 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person1.id,
      })
      const profile2 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person2.id,
      })

      prismaMock.programProfile.findMany.mockResolvedValue([
        { ...profile1, person: person1 },
        { ...profile2, person: person2 },
      ] as any)

      const result = await getAllDugsiRegistrations()

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(profile1.id)
      expect(result[1].id).toBe(profile2.id)
      expect(prismaMock.programProfile.findMany).toHaveBeenCalledWith({
        where: { program: 'DUGSI_PROGRAM' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should return empty array if no registrations found', async () => {
      prismaMock.programProfile.findMany.mockResolvedValue([])

      const result = await getAllDugsiRegistrations()

      expect(result).toHaveLength(0)
    })

    it('should filter out null registrations from mapper', async () => {
      const person = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person.id,
      })

      prismaMock.programProfile.findMany.mockResolvedValue([
        { ...profile, person },
      ] as any)

      // Mock mapper to return null for some profiles
      vi.mocked(mapProfileToDugsiRegistration).mockReturnValueOnce(null)

      const result = await getAllDugsiRegistrations()

      expect(result).toHaveLength(0)
    })
  })

  describe('getFamilyMembers', () => {
    it('should return empty array if student not found', async () => {
      vi.mocked(getProgramProfileById).mockResolvedValue(null)

      const result = await getFamilyMembers('non-existent')

      expect(result).toHaveLength(0)
    })

    it('should return empty array if profile is not Dugsi', async () => {
      const mahadProfile = programProfileFactory({ program: 'MAHAD_PROGRAM' })
      vi.mocked(getProgramProfileById).mockResolvedValue(mahadProfile as any)

      const result = await getFamilyMembers(mahadProfile.id)

      expect(result).toHaveLength(0)
    })

    it('should return single student if no familyReferenceId', async () => {
      const person = personFactory({ name: 'Ahmed Ali' })
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person.id,
        familyReferenceId: null,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...person,
          contactPoints: [emailContact],
        },
      } as any)

      const result = await getFamilyMembers(profile.id)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(profile.id)
      expect(result[0].name).toBe('Ahmed Ali')
    })

    it('should return all family members if familyReferenceId exists', async () => {
      const person1 = personFactory({ name: 'Child 1' })
      const person2 = personFactory({ name: 'Child 2' })
      const profile1 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person1.id,
        familyReferenceId: 'family-123',
      })
      const profile2 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person2.id,
        familyReferenceId: 'family-123',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile1,
        person: person1,
      } as any)

      prismaMock.programProfile.findMany.mockResolvedValue([
        { ...profile1, person: person1 },
        { ...profile2, person: person2 },
      ] as any)

      const result = await getFamilyMembers(profile1.id)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Child 1')
      expect(result[1].name).toBe('Child 2')
      expect(prismaMock.programProfile.findMany).toHaveBeenCalledWith({
        where: {
          familyReferenceId: 'family-123',
          program: 'DUGSI_PROGRAM',
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      })
    })

    it('should filter out null registrations from mapper', async () => {
      const person = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person.id,
        familyReferenceId: 'family-123',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person,
      } as any)

      prismaMock.programProfile.findMany.mockResolvedValue([
        { ...profile, person },
      ] as any)

      vi.mocked(mapProfileToDugsiRegistration).mockReturnValueOnce(null)

      const result = await getFamilyMembers(profile.id)

      expect(result).toHaveLength(0)
    })
  })

  describe('getDeleteFamilyPreview', () => {
    it('should throw error if student not found', async () => {
      vi.mocked(getProgramProfileById).mockResolvedValue(null)

      await expect(getDeleteFamilyPreview('non-existent')).rejects.toThrow(
        'Student not found or not in Dugsi program'
      )
    })

    it('should throw error if profile is not Dugsi', async () => {
      const mahadProfile = programProfileFactory({ program: 'MAHAD_PROGRAM' })
      vi.mocked(getProgramProfileById).mockResolvedValue(mahadProfile as any)

      await expect(getDeleteFamilyPreview(mahadProfile.id)).rejects.toThrow(
        'Student not found or not in Dugsi program'
      )
    })

    it('should return preview for single student if no family', async () => {
      const person = personFactory({ name: 'Ahmed Ali' })
      const guardian = personFactory()
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person.id,
        familyReferenceId: null,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...person,
          guardianRelationships: [
            {
              guardian: {
                ...guardian,
                contactPoints: [emailContact],
              },
            },
          ],
        },
      } as any)

      const result = await getDeleteFamilyPreview(profile.id)

      expect(result.count).toBe(1)
      expect(result.students).toHaveLength(1)
      expect(result.students[0].id).toBe(profile.id)
      expect(result.students[0].name).toBe('Ahmed Ali')
      expect(result.students[0].parentEmail).toBe('parent@test.com')
    })

    it('should return preview for all family members', async () => {
      const person1 = personFactory({ name: 'Child 1' })
      const person2 = personFactory({ name: 'Child 2' })
      const guardian = personFactory()
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const profile1 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person1.id,
        familyReferenceId: 'family-123',
      })
      const profile2 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person2.id,
        familyReferenceId: 'family-123',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile1,
        person: {
          ...person1,
          guardianRelationships: [
            {
              guardian: {
                ...guardian,
                contactPoints: [emailContact],
              },
            },
          ],
        },
      } as any)

      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        { ...profile1, person: person1 },
        { ...profile2, person: person2 },
      ] as any)

      const result = await getDeleteFamilyPreview(profile1.id)

      expect(result.count).toBe(2)
      expect(result.students).toHaveLength(2)
      expect(result.students[0].name).toBe('Child 1')
      expect(result.students[1].name).toBe('Child 2')
    })

    it('should return null parentEmail if no guardian email found', async () => {
      const person = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person.id,
        familyReferenceId: null,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person: {
          ...person,
          guardianRelationships: [],
        },
      } as any)

      const result = await getDeleteFamilyPreview(profile.id)

      expect(result.students[0].parentEmail).toBeNull()
    })
  })

  describe('deleteDugsiFamily', () => {
    it('should throw error if student not found', async () => {
      vi.mocked(getProgramProfileById).mockResolvedValue(null)

      await expect(deleteDugsiFamily('non-existent')).rejects.toThrow(
        'Student not found or not in Dugsi program'
      )
    })

    it('should delete single student if no family', async () => {
      const person = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person.id,
        familyReferenceId: null,
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile,
        person,
      } as any)
      prismaMock.programProfile.delete.mockResolvedValue(profile as any)

      const result = await deleteDugsiFamily(profile.id)

      expect(result).toBe(1)
      expect(prismaMock.programProfile.delete).toHaveBeenCalledWith({
        where: { id: profile.id },
      })
    })

    it('should delete all family members if familyReferenceId exists', async () => {
      const person1 = personFactory()
      const person2 = personFactory()
      const profile1 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person1.id,
        familyReferenceId: 'family-123',
      })
      const profile2 = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person2.id,
        familyReferenceId: 'family-123',
      })

      vi.mocked(getProgramProfileById).mockResolvedValue({
        ...profile1,
        person: person1,
      } as any)

      vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue([
        { ...profile1, person: person1 },
        { ...profile2, person: person2 },
      ] as any)

      prismaMock.programProfile.deleteMany.mockResolvedValue({ count: 2 } as any)

      const result = await deleteDugsiFamily(profile1.id)

      expect(result).toBe(2)
      expect(prismaMock.programProfile.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: [profile1.id, profile2.id] },
        },
      })
    })
  })

  describe('searchDugsiRegistrationsByContact', () => {
    it('should search by email and normalize contact', async () => {
      const person = personFactory({ name: 'Child' })
      const emailContact = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person.id,
      })

      prismaMock.programProfile.findMany.mockResolvedValue([
        {
          ...profile,
          person: {
            ...person,
            contactPoints: [emailContact],
          },
        },
      ] as any)

      const result = await searchDugsiRegistrationsByContact(
        'PARENT@TEST.COM',
        'EMAIL'
      )

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(profile.id)

      const call = prismaMock.programProfile.findMany.mock.calls[0][0]
      expect(call.where.OR[0].person.contactPoints.some.value).toBe(
        'parent@test.com'
      )
    })

    it('should search by phone number', async () => {
      const person = personFactory()
      const phoneContact = contactPointFactory({
        type: 'PHONE',
        value: '1234567890',
      })
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person.id,
      })

      prismaMock.programProfile.findMany.mockResolvedValue([
        {
          ...profile,
          person: {
            ...person,
            contactPoints: [phoneContact],
          },
        },
      ] as any)

      const result = await searchDugsiRegistrationsByContact(
        '1234567890',
        'PHONE'
      )

      expect(result).toHaveLength(1)
      const call = prismaMock.programProfile.findMany.mock.calls[0][0]
      expect(call.where.OR[0].person.contactPoints.some.type).toBe('PHONE')
    })

    it('should search both student and parent contacts', async () => {
      prismaMock.programProfile.findMany.mockResolvedValue([])

      await searchDugsiRegistrationsByContact('test@test.com', 'EMAIL')

      const call = prismaMock.programProfile.findMany.mock.calls[0][0]
      expect(call.where.OR).toHaveLength(2)
      // First OR: student's own contact
      expect(call.where.OR[0].person.contactPoints).toBeDefined()
      // Second OR: parent's contact via guardian relationship
      expect(call.where.OR[1].person.guardianRelationships).toBeDefined()
    })

    it('should return empty array if no matches found', async () => {
      prismaMock.programProfile.findMany.mockResolvedValue([])

      const result = await searchDugsiRegistrationsByContact(
        'notfound@test.com',
        'EMAIL'
      )

      expect(result).toHaveLength(0)
    })

    it('should filter out null registrations from mapper', async () => {
      const person = personFactory()
      const profile = programProfileFactory({
        program: 'DUGSI_PROGRAM',
        personId: person.id,
      })

      prismaMock.programProfile.findMany.mockResolvedValue([
        { ...profile, person },
      ] as any)

      vi.mocked(mapProfileToDugsiRegistration).mockReturnValueOnce(null)

      const result = await searchDugsiRegistrationsByContact(
        'test@test.com',
        'EMAIL'
      )

      expect(result).toHaveLength(0)
    })

    it('should search for active guardians only', async () => {
      prismaMock.programProfile.findMany.mockResolvedValue([])

      await searchDugsiRegistrationsByContact('parent@test.com', 'EMAIL')

      const call = prismaMock.programProfile.findMany.mock.calls[0][0]
      const guardianSearch = call.where.OR[1].person.guardianRelationships.some
      expect(guardianSearch.isActive).toBe(true)
    })
  })
})
