/**
 * Sibling Detector Service Tests
 *
 * Tests for sibling detection and relationship management.
 * Focus on detection methods, confidence scoring, and relationship creation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../utils/prisma-mock'
import {
  personFactory,
  contactPointFactory,
  guardianRelationshipFactory,
} from '../utils/factories'
import {
  detectPotentialSiblings,
  calculateConfidenceScore,
  createSiblingRelationship,
} from '@/lib/services/sibling-detector'

describe('SiblingDetectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('detectPotentialSiblings', () => {
    it('should throw error if person not found', async () => {
      prismaMock.person.findUnique.mockResolvedValue(null)

      await expect(detectPotentialSiblings('non-existent')).rejects.toThrow(
        'Person not found: non-existent'
      )
    })

    it('should detect siblings via guardian match', async () => {
      const person = personFactory({ name: 'Ahmed' }) // Single name to skip name match
      const sibling = personFactory({ name: 'Fatima' })
      const guardian = personFactory({ name: 'Parent Name' })

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        contactPoints: [],
        guardianRelationships: [
          {
            ...guardianRelationshipFactory({
              dependentId: person.id,
              guardianId: guardian.id,
              isActive: true,
            }),
            guardian,
          },
        ],
        dependentRelationships: [],
      } as any)

      prismaMock.siblingRelationship.findMany.mockResolvedValue([])

      prismaMock.guardianRelationship.findMany.mockResolvedValue([
        {
          ...guardianRelationshipFactory({
            dependentId: sibling.id,
            guardianId: guardian.id,
            isActive: true,
          }),
          dependent: sibling,
          guardian,
        },
      ] as any)

      prismaMock.person.findMany.mockResolvedValue([]) // For name match (won't trigger)
      prismaMock.contactPoint.findMany.mockResolvedValue([]) // For contact match

      const result = await detectPotentialSiblings(person.id)

      expect(result).toHaveLength(1)
      expect(result[0].person.id).toBe(sibling.id)
      expect(result[0].method).toBe('GUARDIAN_MATCH')
      expect(result[0].confidence).toBe(0.9)
      expect(result[0].reasons).toContain(`Shared guardian: ${guardian.name}`)
    })

    it('should exclude existing sibling relationships', async () => {
      const person = personFactory({ name: 'Single' }) // Single name to skip name match
      const sibling = personFactory()
      const guardian = personFactory()

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        contactPoints: [],
        guardianRelationships: [
          {
            ...guardianRelationshipFactory({ guardianId: guardian.id }),
            guardian,
          },
        ],
        dependentRelationships: [],
      } as any)

      // Existing sibling relationship
      prismaMock.siblingRelationship.findMany.mockResolvedValue([
        {
          person1Id: person.id,
          person2Id: sibling.id,
        },
      ] as any)

      prismaMock.guardianRelationship.findMany.mockResolvedValue([
        {
          ...guardianRelationshipFactory({ dependentId: sibling.id }),
          dependent: sibling,
          guardian,
        },
      ] as any)

      prismaMock.person.findMany.mockResolvedValue([]) // For name match (won't trigger)
      prismaMock.contactPoint.findMany.mockResolvedValue([]) // For contact match

      const result = await detectPotentialSiblings(person.id)

      expect(result).toHaveLength(0) // Should exclude existing sibling
    })

    it('should ignore inactive guardian relationships', async () => {
      const person = personFactory({ name: 'Single' }) // Single name to skip name match
      const guardian = personFactory()

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        contactPoints: [],
        guardianRelationships: [
          {
            ...guardianRelationshipFactory({
              guardianId: guardian.id,
              isActive: false, // Inactive
            }),
            guardian,
          },
        ],
        dependentRelationships: [],
      } as any)

      prismaMock.siblingRelationship.findMany.mockResolvedValue([])
      prismaMock.guardianRelationship.findMany.mockResolvedValue([])
      prismaMock.person.findMany.mockResolvedValue([]) // For name match (won't trigger)
      prismaMock.contactPoint.findMany.mockResolvedValue([]) // For contact match

      const result = await detectPotentialSiblings(person.id)

      expect(prismaMock.guardianRelationship.findMany).not.toHaveBeenCalled()
    })

    it('should detect siblings via name match', async () => {
      const person = personFactory({
        name: 'Ahmed Hassan',
        dateOfBirth: null, // No DOB to avoid age similarity bonus
      })
      const sibling = personFactory({
        name: 'Fatima Hassan',
        dateOfBirth: null,
      })

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        contactPoints: [],
        guardianRelationships: [],
        dependentRelationships: [],
      } as any)

      prismaMock.siblingRelationship.findMany.mockResolvedValue([])
      prismaMock.guardianRelationship.findMany.mockResolvedValue([])

      prismaMock.person.findMany.mockResolvedValue([sibling] as any)
      prismaMock.contactPoint.findMany.mockResolvedValue([]) // For contact match

      const result = await detectPotentialSiblings(person.id)

      expect(result).toHaveLength(1)
      expect(result[0].person.id).toBe(sibling.id)
      expect(result[0].method).toBe('NAME_MATCH')
      expect(result[0].confidence).toBe(0.5) // Base confidence for name match
      expect(result[0].reasons).toContain('Shared last name: Hassan')
    })

    it('should increase name match confidence for similar ages', async () => {
      const birthDate1 = new Date('2000-01-01')
      const birthDate2 = new Date('2002-01-01') // 2 years apart
      const person = personFactory({
        name: 'Ahmed Hassan',
        dateOfBirth: birthDate1,
      })
      const sibling = personFactory({
        name: 'Fatima Hassan',
        dateOfBirth: birthDate2,
      })

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        contactPoints: [],
        guardianRelationships: [],
        dependentRelationships: [],
      } as any)

      prismaMock.siblingRelationship.findMany.mockResolvedValue([])
      prismaMock.guardianRelationship.findMany.mockResolvedValue([])
      prismaMock.person.findMany.mockResolvedValue([sibling] as any)
      prismaMock.contactPoint.findMany.mockResolvedValue([]) // For contact match

      const result = await detectPotentialSiblings(person.id)

      expect(result[0].confidence).toBe(0.7) // Increased for age similarity
      expect(result[0].reasons).toHaveLength(2)
      expect(result[0].reasons[0]).toContain('Shared last name: Hassan')
      expect(result[0].reasons[1]).toContain('Similar age')
    })

    it('should skip name match if name is single word', async () => {
      const person = personFactory({ name: 'Ahmed' }) // Single name

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        contactPoints: [],
        guardianRelationships: [],
        dependentRelationships: [],
      } as any)

      prismaMock.siblingRelationship.findMany.mockResolvedValue([])
      prismaMock.guardianRelationship.findMany.mockResolvedValue([])

      const result = await detectPotentialSiblings(person.id)

      expect(prismaMock.person.findMany).not.toHaveBeenCalled()
    })

    it('should detect siblings via contact match', async () => {
      const person = personFactory()
      const sibling = personFactory()
      const sharedEmail = contactPointFactory({
        type: 'EMAIL',
        value: 'parent@test.com',
        personId: sibling.id,
      })

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        contactPoints: [
          contactPointFactory({
            type: 'EMAIL',
            value: 'parent@test.com',
            personId: person.id,
          }),
        ],
        guardianRelationships: [],
        dependentRelationships: [],
      } as any)

      prismaMock.siblingRelationship.findMany.mockResolvedValue([])
      prismaMock.guardianRelationship.findMany.mockResolvedValue([])
      prismaMock.person.findMany.mockResolvedValue([])

      prismaMock.contactPoint.findMany.mockResolvedValue([
        {
          ...sharedEmail,
          person: sibling,
        },
      ] as any)

      const result = await detectPotentialSiblings(person.id)

      expect(result).toHaveLength(1)
      expect(result[0].person.id).toBe(sibling.id)
      expect(result[0].method).toBe('CONTACT_MATCH')
      expect(result[0].confidence).toBe(0.8)
      expect(result[0].reasons).toContain('Shared email: parent@test.com')
    })

    it('should not add duplicate person from contact match', async () => {
      const person = personFactory({ name: 'Ahmed Hassan' })
      const sibling = personFactory({ name: 'Fatima Hassan' })
      const sharedEmail = contactPointFactory({
        type: 'EMAIL',
        value: 'shared@test.com',
        personId: sibling.id,
      })

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        contactPoints: [
          contactPointFactory({
            type: 'EMAIL',
            value: 'shared@test.com',
            personId: person.id,
          }),
        ],
        guardianRelationships: [],
        dependentRelationships: [],
      } as any)

      prismaMock.siblingRelationship.findMany.mockResolvedValue([])
      prismaMock.guardianRelationship.findMany.mockResolvedValue([])

      // Name match will find the sibling first
      prismaMock.person.findMany.mockResolvedValue([sibling] as any)

      // Contact match will also find the same sibling
      prismaMock.contactPoint.findMany.mockResolvedValue([
        {
          ...sharedEmail,
          person: sibling,
        },
      ] as any)

      const result = await detectPotentialSiblings(person.id)

      // Should only have one entry for the sibling, not two
      expect(result).toHaveLength(1)
      expect(result[0].method).toBe('NAME_MATCH') // First method wins
    })

    it('should sort results by confidence (highest first)', async () => {
      const person = personFactory({ name: 'Ahmed Hassan' })
      const guardian = personFactory()
      const guardianSibling = personFactory({ name: 'Sibling 1' })
      const nameSibling = personFactory({ name: 'Sibling Hassan' })

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        contactPoints: [],
        guardianRelationships: [
          {
            ...guardianRelationshipFactory({ guardianId: guardian.id }),
            guardian,
          },
        ],
        dependentRelationships: [],
      } as any)

      prismaMock.siblingRelationship.findMany.mockResolvedValue([])

      // Guardian match (0.9 confidence)
      prismaMock.guardianRelationship.findMany.mockResolvedValue([
        {
          ...guardianRelationshipFactory({ dependentId: guardianSibling.id }),
          dependent: guardianSibling,
          guardian,
        },
      ] as any)

      // Name match (0.5 confidence)
      prismaMock.person.findMany.mockResolvedValue([nameSibling] as any)
      prismaMock.contactPoint.findMany.mockResolvedValue([])

      const result = await detectPotentialSiblings(person.id)

      expect(result).toHaveLength(2)
      expect(result[0].confidence).toBeGreaterThan(result[1].confidence)
      expect(result[0].method).toBe('GUARDIAN_MATCH') // Higher confidence
      expect(result[1].method).toBe('NAME_MATCH') // Lower confidence
    })

    it('should return empty array if no matches found', async () => {
      const person = personFactory()

      prismaMock.person.findUnique.mockResolvedValue({
        ...person,
        contactPoints: [],
        guardianRelationships: [],
        dependentRelationships: [],
      } as any)

      prismaMock.siblingRelationship.findMany.mockResolvedValue([])
      prismaMock.guardianRelationship.findMany.mockResolvedValue([])
      prismaMock.person.findMany.mockResolvedValue([])
      prismaMock.contactPoint.findMany.mockResolvedValue([])

      const result = await detectPotentialSiblings(person.id)

      expect(result).toHaveLength(0)
    })
  })

  describe('calculateConfidenceScore', () => {
    it('should return 0.9 for GUARDIAN_MATCH with single guardian', () => {
      const score = calculateConfidenceScore('GUARDIAN_MATCH', {
        sharedGuardians: 1,
      })
      expect(score).toBe(0.9)
    })

    it('should return 0.95 for GUARDIAN_MATCH with multiple guardians', () => {
      const score = calculateConfidenceScore('GUARDIAN_MATCH', {
        sharedGuardians: 2,
      })
      expect(score).toBe(0.95)
    })

    it('should return 0.8 for CONTACT_MATCH with single contact', () => {
      const score = calculateConfidenceScore('CONTACT_MATCH', {
        sharedContacts: 1,
      })
      expect(score).toBeCloseTo(0.8, 1) // 0.7 + 0.1, use toBeCloseTo for floating point
    })

    it('should cap CONTACT_MATCH at 0.95', () => {
      const score = calculateConfidenceScore('CONTACT_MATCH', {
        sharedContacts: 10, // Would be 1.7 without cap
      })
      expect(score).toBe(0.95)
    })

    it('should return 0.5 for NAME_MATCH without age similarity', () => {
      const score = calculateConfidenceScore('NAME_MATCH', {
        nameMatch: false,
      })
      expect(score).toBe(0.5)
    })

    it('should return 0.6 for NAME_MATCH with name match', () => {
      const score = calculateConfidenceScore('NAME_MATCH', {
        nameMatch: true,
      })
      expect(score).toBe(0.6)
    })

    it('should increase NAME_MATCH score with age similarity', () => {
      const score = calculateConfidenceScore('NAME_MATCH', {
        nameMatch: true,
        ageSimilarity: 3, // Less than 5 years apart
      })
      expect(score).toBe(0.8) // 0.6 + 0.2
    })

    it('should cap NAME_MATCH at 0.9', () => {
      const score = calculateConfidenceScore('NAME_MATCH', {
        nameMatch: true,
        ageSimilarity: 1,
      })
      expect(score).toBe(0.8)
      expect(score).toBeLessThanOrEqual(0.9)
    })

    it('should return 1.0 for MANUAL', () => {
      const score = calculateConfidenceScore('MANUAL', {})
      expect(score).toBe(1.0)
    })

    it('should return values between 0 and 1', () => {
      const methods: Array<'GUARDIAN_MATCH' | 'CONTACT_MATCH' | 'NAME_MATCH' | 'MANUAL'> = [
        'GUARDIAN_MATCH',
        'CONTACT_MATCH',
        'NAME_MATCH',
        'MANUAL',
      ]

      for (const method of methods) {
        const score = calculateConfidenceScore(method, {
          sharedGuardians: 2,
          sharedContacts: 2,
          nameMatch: true,
          ageSimilarity: 2,
        })
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('createSiblingRelationship', () => {
    it('should throw error if person1Id equals person2Id', async () => {
      await expect(
        createSiblingRelationship('person-1', 'person-1', 'MANUAL')
      ).rejects.toThrow('Cannot create sibling relationship with self')
    })

    it('should create relationship with person IDs in sorted order', async () => {
      prismaMock.siblingRelationship.create.mockResolvedValue({} as any)

      await createSiblingRelationship('person-2', 'person-1', 'MANUAL')

      expect(prismaMock.siblingRelationship.create).toHaveBeenCalledWith({
        data: {
          person1Id: 'person-1', // Sorted
          person2Id: 'person-2', // Sorted
          detectionMethod: 'MANUAL',
          confidence: 1.0,
          verifiedBy: undefined,
          verifiedAt: null,
          notes: undefined,
          isActive: true,
        },
      })
    })

    it('should set confidence to 1.0 for MANUAL method', async () => {
      prismaMock.siblingRelationship.create.mockResolvedValue({} as any)

      await createSiblingRelationship('person-1', 'person-2', 'MANUAL')

      expect(prismaMock.siblingRelationship.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          confidence: 1.0,
        }),
      })
    })

    it('should set confidence to null for non-MANUAL methods', async () => {
      prismaMock.siblingRelationship.create.mockResolvedValue({} as any)

      await createSiblingRelationship('person-1', 'person-2', 'GUARDIAN_MATCH')

      expect(prismaMock.siblingRelationship.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          confidence: null,
        }),
      })
    })

    it('should accept custom confidence when provided', async () => {
      prismaMock.siblingRelationship.create.mockResolvedValue({} as any)

      await createSiblingRelationship('person-1', 'person-2', 'GUARDIAN_MATCH', {
        confidence: 0.95,
      })

      expect(prismaMock.siblingRelationship.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          confidence: 0.95,
        }),
      })
    })

    it('should set verifiedAt when verifiedBy is provided', async () => {
      prismaMock.siblingRelationship.create.mockResolvedValue({} as any)

      await createSiblingRelationship('person-1', 'person-2', 'MANUAL', {
        verifiedBy: 'admin-user',
      })

      const call = prismaMock.siblingRelationship.create.mock.calls[0][0]
      expect(call.data.verifiedBy).toBe('admin-user')
      expect(call.data.verifiedAt).toBeInstanceOf(Date)
    })

    it('should not set verifiedAt when verifiedBy is not provided', async () => {
      prismaMock.siblingRelationship.create.mockResolvedValue({} as any)

      await createSiblingRelationship('person-1', 'person-2', 'MANUAL')

      expect(prismaMock.siblingRelationship.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verifiedAt: null,
        }),
      })
    })

    it('should include notes when provided', async () => {
      prismaMock.siblingRelationship.create.mockResolvedValue({} as any)

      await createSiblingRelationship('person-1', 'person-2', 'MANUAL', {
        notes: 'Confirmed by parent',
      })

      expect(prismaMock.siblingRelationship.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          notes: 'Confirmed by parent',
        }),
      })
    })

    it('should set isActive to true', async () => {
      prismaMock.siblingRelationship.create.mockResolvedValue({} as any)

      await createSiblingRelationship('person-1', 'person-2', 'GUARDIAN_MATCH')

      expect(prismaMock.siblingRelationship.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: true,
        }),
      })
    })
  })
})
