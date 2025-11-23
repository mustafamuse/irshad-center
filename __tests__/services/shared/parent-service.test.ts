/**
 * Parent/Guardian Service Tests
 *
 * Tests for cross-program guardian/parent management operations.
 * Focus on business logic: normalization, relationship management, data validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../utils/prisma-mock'
import { personFactory, contactPointFactory, guardianRelationshipFactory } from '../../utils/factories'
import {
  updateGuardianInfo,
  addGuardianRelationship,
  removeGuardianRelationship,
  getGuardianDependents,
  getDependentGuardians,
  validateGuardianEmail,
  findGuardianByEmail,
} from '@/lib/services/shared/parent-service'

// Mock normalizePhone utility
vi.mock('@/lib/types/person', () => ({
  normalizePhone: (phone: string) => {
    if (!phone) return null
    // Simple normalization for tests
    const cleaned = phone.replace(/\D/g, '')
    return cleaned.length >= 10 ? cleaned : null
  },
}))

describe('ParentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateGuardianInfo', () => {
    it('should build full name from firstName and lastName', async () => {
      const guardian = personFactory({ name: 'Old Name' })
      prismaMock.person.update.mockResolvedValue(guardian as any)
      prismaMock.person.findUnique.mockResolvedValue({
        ...guardian,
        contactPoints: [],
      } as any)

      await updateGuardianInfo(guardian.id, {
        firstName: 'John',
        lastName: 'Doe',
      })

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: guardian.id },
        data: { name: 'John Doe' },
      })
    })

    it('should normalize email to lowercase', async () => {
      const guardian = personFactory()
      const existingEmail = contactPointFactory({
        personId: guardian.id,
        type: 'EMAIL',
        value: 'old@example.com',
      })

      prismaMock.person.update.mockResolvedValue(guardian as any)
      prismaMock.person.findUnique
        .mockResolvedValueOnce({
          ...guardian,
          contactPoints: [existingEmail],
        } as any)
        .mockResolvedValueOnce({
          ...guardian,
          contactPoints: [{ ...existingEmail, value: 'john@test.com' }],
        } as any)

      await updateGuardianInfo(guardian.id, {
        firstName: 'John',
        lastName: 'Doe',
        email: 'JOHN@TEST.COM', // Uppercase
      })

      expect(prismaMock.contactPoint.update).toHaveBeenCalledWith({
        where: { id: existingEmail.id },
        data: { value: 'john@test.com' }, // Lowercase
      })
    })

    it('should create email contact point if none exists', async () => {
      const guardian = personFactory()

      prismaMock.person.update.mockResolvedValue(guardian as any)
      prismaMock.person.findUnique
        .mockResolvedValueOnce({
          ...guardian,
          contactPoints: [], // No existing email
        } as any)
        .mockResolvedValueOnce({
          ...guardian,
          contactPoints: [],
        } as any)

      await updateGuardianInfo(guardian.id, {
        firstName: 'John',
        lastName: 'Doe',
        email: 'new@test.com',
      })

      expect(prismaMock.contactPoint.create).toHaveBeenCalledWith({
        data: {
          personId: guardian.id,
          type: 'EMAIL',
          value: 'new@test.com',
          isPrimary: true,
        },
      })
    })

    it('should normalize phone number', async () => {
      const guardian = personFactory()
      const existingPhone = contactPointFactory({
        personId: guardian.id,
        type: 'PHONE',
        value: '1234567890',
      })

      prismaMock.person.update.mockResolvedValue(guardian as any)
      prismaMock.person.findUnique
        .mockResolvedValueOnce({
          ...guardian,
          contactPoints: [existingPhone],
        } as any)
        .mockResolvedValueOnce({
          ...guardian,
          contactPoints: [existingPhone],
        } as any)

      await updateGuardianInfo(guardian.id, {
        firstName: 'John',
        lastName: 'Doe',
        phone: '(123) 456-7890', // Formatted
      })

      expect(prismaMock.contactPoint.update).toHaveBeenCalledWith({
        where: { id: existingPhone.id },
        data: { value: '1234567890' }, // Normalized
      })
    })

    it('should handle WhatsApp type when updating phone', async () => {
      const guardian = personFactory()
      const existingWhatsApp = contactPointFactory({
        personId: guardian.id,
        type: 'WHATSAPP',
        value: '1234567890',
      })

      prismaMock.person.update.mockResolvedValue(guardian as any)
      prismaMock.person.findUnique
        .mockResolvedValueOnce({
          ...guardian,
          contactPoints: [existingWhatsApp],
        } as any)
        .mockResolvedValueOnce({
          ...guardian,
          contactPoints: [existingWhatsApp],
        } as any)

      await updateGuardianInfo(guardian.id, {
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
      })

      expect(prismaMock.contactPoint.update).toHaveBeenCalledWith({
        where: { id: existingWhatsApp.id },
        data: { value: '9876543210' },
      })
    })

    it('should not create phone contact if normalization returns null', async () => {
      const guardian = personFactory()

      prismaMock.person.update.mockResolvedValue(guardian as any)
      prismaMock.person.findUnique
        .mockResolvedValueOnce({
          ...guardian,
          contactPoints: [],
        } as any)
        .mockResolvedValueOnce({
          ...guardian,
          contactPoints: [],
        } as any)

      await updateGuardianInfo(guardian.id, {
        firstName: 'John',
        lastName: 'Doe',
        phone: '123', // Too short, will normalize to null
      })

      expect(prismaMock.contactPoint.create).not.toHaveBeenCalled()
    })

    it('should throw error if guardian not found', async () => {
      prismaMock.person.update.mockResolvedValue(personFactory() as any)
      prismaMock.person.findUnique.mockResolvedValue(null)

      await expect(
        updateGuardianInfo('non-existent', {
          firstName: 'John',
          lastName: 'Doe',
        })
      ).rejects.toThrow('Guardian not found')
    })
  })

  describe('addGuardianRelationship', () => {
    it('should create new guardian person if email not found', async () => {
      const dependent = personFactory()
      const newGuardian = personFactory({ name: 'Jane Doe' })

      prismaMock.person.findFirst.mockResolvedValue(null) // No existing person
      prismaMock.person.create.mockResolvedValue(newGuardian as any)
      prismaMock.guardianRelationship.findFirst.mockResolvedValue(null)
      prismaMock.guardianRelationship.create.mockResolvedValue({
        id: 'relationship-1',
        guardianId: newGuardian.id,
        dependentId: dependent.id,
      } as any)

      await addGuardianRelationship(dependent.id, {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        phone: '1234567890',
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          name: 'Jane Doe',
          contactPoints: {
            create: [
              {
                type: 'EMAIL',
                value: 'jane@test.com',
                isPrimary: true,
              },
              {
                type: 'PHONE',
                value: '1234567890',
                isPrimary: false,
              },
            ],
          },
        },
      })
    })

    it('should normalize email before checking for existing person', async () => {
      const existingGuardian = personFactory()
      const dependent = personFactory()

      prismaMock.person.findFirst.mockResolvedValue(existingGuardian as any)
      prismaMock.guardianRelationship.findFirst.mockResolvedValue(null)
      prismaMock.guardianRelationship.create.mockResolvedValue({} as any)

      await addGuardianRelationship(dependent.id, {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'JANE@TEST.COM', // Uppercase
        phone: '1234567890',
      })

      expect(prismaMock.person.findFirst).toHaveBeenCalledWith({
        where: {
          contactPoints: {
            some: {
              type: 'EMAIL',
              value: 'jane@test.com', // Lowercase
            },
          },
        },
      })
    })

    it('should reuse existing guardian person if email matches', async () => {
      const existingGuardian = personFactory({ name: 'Jane Doe' })
      const dependent = personFactory()

      prismaMock.person.findFirst.mockResolvedValue(existingGuardian as any)
      prismaMock.guardianRelationship.findFirst.mockResolvedValue(null)
      prismaMock.guardianRelationship.create.mockResolvedValue({
        id: 'relationship-1',
        guardianId: existingGuardian.id,
        dependentId: dependent.id,
      } as any)

      await addGuardianRelationship(dependent.id, {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        phone: '1234567890',
      })

      expect(prismaMock.person.create).not.toHaveBeenCalled()
      expect(prismaMock.guardianRelationship.create).toHaveBeenCalledWith({
        data: {
          guardianId: existingGuardian.id,
          dependentId: dependent.id,
          role: 'PARENT',
          isActive: true,
        },
      })
    })

    it('should reactivate inactive relationship if it exists', async () => {
      const guardian = personFactory()
      const dependent = personFactory()
      const inactiveRelationship = guardianRelationshipFactory({
        guardianId: guardian.id,
        dependentId: dependent.id,
        isActive: false,
      })

      prismaMock.person.findFirst.mockResolvedValue(guardian as any)
      prismaMock.guardianRelationship.findFirst.mockResolvedValue(
        inactiveRelationship as any
      )
      prismaMock.guardianRelationship.update.mockResolvedValue({
        ...inactiveRelationship,
        isActive: true,
      } as any)

      const result = await addGuardianRelationship(dependent.id, {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        phone: '1234567890',
      })

      expect(prismaMock.guardianRelationship.update).toHaveBeenCalledWith({
        where: { id: inactiveRelationship.id },
        data: {
          isActive: true,
          endDate: null,
        },
      })
    })

    it('should return existing relationship if already active', async () => {
      const guardian = personFactory()
      const dependent = personFactory()
      const activeRelationship = guardianRelationshipFactory({
        guardianId: guardian.id,
        dependentId: dependent.id,
        isActive: true,
      })

      prismaMock.person.findFirst.mockResolvedValue(guardian as any)
      prismaMock.guardianRelationship.findFirst.mockResolvedValue(
        activeRelationship as any
      )

      const result = await addGuardianRelationship(dependent.id, {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        phone: '1234567890',
      })

      expect(result).toEqual(activeRelationship)
      expect(prismaMock.guardianRelationship.create).not.toHaveBeenCalled()
      expect(prismaMock.guardianRelationship.update).not.toHaveBeenCalled()
    })

    it('should use custom role if provided', async () => {
      const guardian = personFactory()
      const dependent = personFactory()

      prismaMock.person.findFirst.mockResolvedValue(guardian as any)
      prismaMock.guardianRelationship.findFirst.mockResolvedValue(null)
      prismaMock.guardianRelationship.create.mockResolvedValue({} as any)

      await addGuardianRelationship(dependent.id, {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        phone: '1234567890',
        role: 'GUARDIAN',
      })

      expect(prismaMock.guardianRelationship.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'GUARDIAN',
          }),
        })
      )
    })

    it('should not add phone to contact points if normalization fails', async () => {
      const dependent = personFactory()
      const newGuardian = personFactory()

      prismaMock.person.findFirst.mockResolvedValue(null)
      prismaMock.person.create.mockResolvedValue(newGuardian as any)
      prismaMock.guardianRelationship.findFirst.mockResolvedValue(null)
      prismaMock.guardianRelationship.create.mockResolvedValue({} as any)

      await addGuardianRelationship(dependent.id, {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
        phone: '123', // Too short
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          name: 'Jane Doe',
          contactPoints: {
            create: [
              {
                type: 'EMAIL',
                value: 'jane@test.com',
                isPrimary: true,
              },
              // No phone contact point
            ],
          },
        },
      })
    })
  })

  describe('removeGuardianRelationship', () => {
    it('should deactivate active relationship', async () => {
      const guardian = personFactory()
      const dependent = personFactory()
      const relationship = guardianRelationshipFactory({
        guardianId: guardian.id,
        dependentId: dependent.id,
        isActive: true,
      })

      prismaMock.guardianRelationship.findFirst.mockResolvedValue(
        relationship as any
      )
      prismaMock.guardianRelationship.update.mockResolvedValue({
        ...relationship,
        isActive: false,
      } as any)

      const result = await removeGuardianRelationship(
        guardian.id,
        dependent.id
      )

      expect(prismaMock.guardianRelationship.update).toHaveBeenCalledWith({
        where: { id: relationship.id },
        data: {
          isActive: false,
          endDate: expect.any(Date),
        },
      })
    })

    it('should throw error if active relationship not found', async () => {
      prismaMock.guardianRelationship.findFirst.mockResolvedValue(null)

      await expect(
        removeGuardianRelationship('guardian-1', 'dependent-1')
      ).rejects.toThrow('Active guardian relationship not found')
    })

    it('should use specified role when finding relationship', async () => {
      const guardian = personFactory()
      const dependent = personFactory()

      prismaMock.guardianRelationship.findFirst.mockResolvedValue(null)

      await expect(
        removeGuardianRelationship(guardian.id, dependent.id, 'GUARDIAN')
      ).rejects.toThrow()

      expect(prismaMock.guardianRelationship.findFirst).toHaveBeenCalledWith({
        where: {
          guardianId: guardian.id,
          dependentId: dependent.id,
          role: 'GUARDIAN',
          isActive: true,
        },
      })
    })
  })

  describe('getGuardianDependents', () => {
    it('should return active dependents by default', async () => {
      const guardian = personFactory()

      prismaMock.guardianRelationship.findMany.mockResolvedValue([])

      await getGuardianDependents(guardian.id)

      expect(prismaMock.guardianRelationship.findMany).toHaveBeenCalledWith({
        where: { guardianId: guardian.id, isActive: true },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      })
    })

    it('should return all dependents if activeOnly is false', async () => {
      const guardian = personFactory()

      prismaMock.guardianRelationship.findMany.mockResolvedValue([])

      await getGuardianDependents(guardian.id, false)

      expect(prismaMock.guardianRelationship.findMany).toHaveBeenCalledWith({
        where: { guardianId: guardian.id },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('getDependentGuardians', () => {
    it('should return active guardians by default', async () => {
      const dependent = personFactory()

      prismaMock.guardianRelationship.findMany.mockResolvedValue([])

      await getDependentGuardians(dependent.id)

      expect(prismaMock.guardianRelationship.findMany).toHaveBeenCalledWith({
        where: { dependentId: dependent.id, isActive: true },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      })
    })

    it('should return all guardians if activeOnly is false', async () => {
      const dependent = personFactory()

      prismaMock.guardianRelationship.findMany.mockResolvedValue([])

      await getDependentGuardians(dependent.id, false)

      expect(prismaMock.guardianRelationship.findMany).toHaveBeenCalledWith({
        where: { dependentId: dependent.id },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('validateGuardianEmail', () => {
    it('should normalize email before searching', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null)

      await validateGuardianEmail('TEST@EXAMPLE.COM')

      expect(prismaMock.person.findFirst).toHaveBeenCalledWith({
        where: {
          contactPoints: {
            some: {
              type: 'EMAIL',
              value: 'test@example.com',
            },
          },
        },
        include: expect.any(Object),
      })
    })

    it('should return person if email exists', async () => {
      const existingPerson = personFactory()
      prismaMock.person.findFirst.mockResolvedValue(existingPerson as any)

      const result = await validateGuardianEmail('test@example.com')

      expect(result).toEqual(existingPerson)
    })

    it('should return null if email not found', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null)

      const result = await validateGuardianEmail('test@example.com')

      expect(result).toBeNull()
    })
  })

  describe('findGuardianByEmail', () => {
    it('should normalize email before searching', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null)

      await findGuardianByEmail('TEST@EXAMPLE.COM')

      expect(prismaMock.person.findFirst).toHaveBeenCalledWith({
        where: {
          contactPoints: {
            some: {
              type: 'EMAIL',
              value: 'test@example.com',
            },
          },
        },
        include: expect.any(Object),
      })
    })

    it('should return guardian with dependent relationships', async () => {
      const guardian = personFactory()
      prismaMock.person.findFirst.mockResolvedValue(guardian as any)

      const result = await findGuardianByEmail('test@example.com')

      expect(result).toEqual(guardian)
      expect(prismaMock.person.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            contactPoints: true,
            dependentRelationships: expect.any(Object),
          }),
        })
      )
    })
  })
})
