/**
 * Registration Service Tests
 *
 * Tests for linkGuardianToDependent with isPrimaryPayer logic.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockFindFirst,
  mockCreate,
  mockUpdate,
  mockValidateGuardianRelationship,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockValidateGuardianRelationship: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    guardianRelationship: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

vi.mock('@/lib/services/validation-service', () => ({
  validateGuardianRelationship: (...args: unknown[]) =>
    mockValidateGuardianRelationship(...args),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import { linkGuardianToDependent } from '../registration-service'

describe('linkGuardianToDependent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateGuardianRelationship.mockResolvedValue(undefined)
  })

  describe('isPrimaryPayer handling', () => {
    it('should set isPrimaryPayer=true when specified', async () => {
      mockFindFirst.mockResolvedValue(null)
      mockCreate.mockResolvedValue({
        id: 'rel-1',
        guardianId: 'guardian-1',
        dependentId: 'child-1',
        role: 'PARENT',
        isPrimaryPayer: true,
        isActive: true,
      })

      await linkGuardianToDependent({
        guardianPersonId: 'guardian-1',
        dependentPersonId: 'child-1',
        role: 'PARENT',
        isPrimaryPayer: true,
      })

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guardianId: 'guardian-1',
          dependentId: 'child-1',
          isPrimaryPayer: true,
        }),
      })
    })

    it('should default isPrimaryPayer to false when not specified', async () => {
      mockFindFirst.mockResolvedValue(null)
      mockCreate.mockResolvedValue({
        id: 'rel-1',
        guardianId: 'guardian-1',
        dependentId: 'child-1',
        role: 'PARENT',
        isPrimaryPayer: false,
        isActive: true,
      })

      await linkGuardianToDependent({
        guardianPersonId: 'guardian-1',
        dependentPersonId: 'child-1',
        role: 'PARENT',
      })

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isPrimaryPayer: false,
        }),
      })
    })

    it('should update isPrimaryPayer on re-registration when value changes', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-rel',
        guardianId: 'guardian-1',
        dependentId: 'child-1',
        isPrimaryPayer: false,
        isActive: true,
      })
      mockUpdate.mockResolvedValue({
        id: 'existing-rel',
        guardianId: 'guardian-1',
        dependentId: 'child-1',
        isPrimaryPayer: true,
        isActive: true,
      })

      await linkGuardianToDependent({
        guardianPersonId: 'guardian-1',
        dependentPersonId: 'child-1',
        role: 'PARENT',
        isPrimaryPayer: true,
      })

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'existing-rel' },
        data: expect.objectContaining({
          isPrimaryPayer: true,
          isActive: true,
        }),
      })
    })

    it('should not update when isPrimaryPayer is unchanged and relationship is active', async () => {
      const existingRelationship = {
        id: 'existing-rel',
        guardianId: 'guardian-1',
        dependentId: 'child-1',
        isPrimaryPayer: true,
        isActive: true,
      }
      mockFindFirst.mockResolvedValue(existingRelationship)

      const result = await linkGuardianToDependent({
        guardianPersonId: 'guardian-1',
        dependentPersonId: 'child-1',
        role: 'PARENT',
        isPrimaryPayer: true,
      })

      expect(mockUpdate).not.toHaveBeenCalled()
      expect(result).toEqual(existingRelationship)
    })

    it('should reactivate and update isPrimaryPayer for inactive relationship', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-rel',
        guardianId: 'guardian-1',
        dependentId: 'child-1',
        isPrimaryPayer: false,
        isActive: false,
      })
      mockUpdate.mockResolvedValue({
        id: 'existing-rel',
        guardianId: 'guardian-1',
        dependentId: 'child-1',
        isPrimaryPayer: true,
        isActive: true,
      })

      await linkGuardianToDependent({
        guardianPersonId: 'guardian-1',
        dependentPersonId: 'child-1',
        role: 'PARENT',
        isPrimaryPayer: true,
      })

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'existing-rel' },
        data: expect.objectContaining({
          isActive: true,
          isPrimaryPayer: true,
        }),
      })
    })
  })
})
