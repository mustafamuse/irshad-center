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
  mockUpdateMany,
  mockValidateGuardianRelationship,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockValidateGuardianRelationship: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    guardianRelationship: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
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
    mockUpdateMany.mockResolvedValue({ count: 0 })
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

    it('should clear other isPrimaryPayer flags when setting new primary payer', async () => {
      mockFindFirst.mockResolvedValue(null)
      mockCreate.mockResolvedValue({
        id: 'rel-1',
        guardianId: 'guardian-1',
        dependentId: 'child-1',
        isPrimaryPayer: true,
        isActive: true,
      })
      mockUpdateMany.mockResolvedValue({ count: 1 })

      await linkGuardianToDependent({
        guardianPersonId: 'guardian-1',
        dependentPersonId: 'child-1',
        role: 'PARENT',
        isPrimaryPayer: true,
      })

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          dependentId: 'child-1',
          guardianId: { not: 'guardian-1' },
          isActive: true,
          isPrimaryPayer: true,
        },
        data: { isPrimaryPayer: false },
      })
    })

    it('should not clear isPrimaryPayer flags when isPrimaryPayer is false', async () => {
      mockFindFirst.mockResolvedValue(null)
      mockCreate.mockResolvedValue({
        id: 'rel-1',
        guardianId: 'guardian-1',
        dependentId: 'child-1',
        isPrimaryPayer: false,
        isActive: true,
      })

      await linkGuardianToDependent({
        guardianPersonId: 'guardian-1',
        dependentPersonId: 'child-1',
        role: 'PARENT',
        isPrimaryPayer: false,
      })

      expect(mockUpdateMany).not.toHaveBeenCalled()
    })
  })

  describe('createGuardianRelationshipsBatch', () => {
    const {
      mockFindMany,
      mockCreateMany,
      mockUpdateMany: mockUpdateManyBatch,
      mockLoggerWarn,
      mockLoggerError,
    } = vi.hoisted(() => ({
      mockFindMany: vi.fn(),
      mockCreateMany: vi.fn(),
      mockUpdateMany: vi.fn(),
      mockLoggerWarn: vi.fn(),
      mockLoggerError: vi.fn(),
    }))

    const mockTx = {
      guardianRelationship: {
        findMany: mockFindMany,
        createMany: mockCreateMany,
        updateMany: mockUpdateManyBatch,
      },
    }

    vi.mock('@/lib/logger', () => ({
      createServiceLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: mockLoggerWarn,
        error: mockLoggerError,
        debug: vi.fn(),
      })),
    }))

    beforeEach(() => {
      vi.clearAllMocks()
      mockUpdateManyBatch.mockResolvedValue({ count: 0 })
    })

    it('should batch create relationships efficiently', async () => {
      const { createGuardianRelationshipsBatch } = await import(
        '../registration-service'
      )

      mockFindMany.mockResolvedValue([])
      mockCreateMany.mockResolvedValue({ count: 2 })

      await createGuardianRelationshipsBatch(
        [
          {
            guardianPersonId: 'parent-1',
            dependentPersonId: 'child-1',
            role: 'PARENT',
            isPrimaryPayer: true,
          },
          {
            guardianPersonId: 'parent-2',
            dependentPersonId: 'child-1',
            role: 'PARENT',
            isPrimaryPayer: false,
          },
        ],
        mockTx as never
      )

      expect(mockFindMany).toHaveBeenCalledTimes(1)
      expect(mockCreateMany).toHaveBeenCalledTimes(1)
      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            guardianId: 'parent-1',
            dependentId: 'child-1',
            isPrimaryPayer: true,
          }),
          expect.objectContaining({
            guardianId: 'parent-2',
            dependentId: 'child-1',
            isPrimaryPayer: false,
          }),
        ]),
        skipDuplicates: true,
      })
    })

    it('should handle existing relationships correctly', async () => {
      const { createGuardianRelationshipsBatch } = await import(
        '../registration-service'
      )

      mockFindMany.mockResolvedValue([
        {
          id: 'existing-1',
          guardianId: 'parent-1',
          dependentId: 'child-1',
          isActive: false,
        },
      ])
      mockCreateMany.mockResolvedValue({ count: 0 })
      mockUpdateManyBatch.mockResolvedValue({ count: 1 })

      await createGuardianRelationshipsBatch(
        [
          {
            guardianPersonId: 'parent-1',
            dependentPersonId: 'child-1',
            role: 'PARENT',
            isPrimaryPayer: true,
          },
        ],
        mockTx as never
      )

      expect(mockCreateMany).not.toHaveBeenCalled()
      expect(mockUpdateManyBatch).toHaveBeenCalledWith({
        where: { id: { in: ['existing-1'] } },
        data: { isActive: true },
      })
    })

    it('should correctly set isPrimaryPayer flags', async () => {
      const { createGuardianRelationshipsBatch } = await import(
        '../registration-service'
      )

      mockFindMany.mockResolvedValue([
        {
          id: 'existing-1',
          guardianId: 'parent-2',
          dependentId: 'child-1',
          isActive: true,
          isPrimaryPayer: true,
        },
      ])
      mockCreateMany.mockResolvedValue({ count: 1 })
      mockUpdateManyBatch.mockResolvedValue({ count: 1 })

      await createGuardianRelationshipsBatch(
        [
          {
            guardianPersonId: 'parent-1',
            dependentPersonId: 'child-1',
            role: 'PARENT',
            isPrimaryPayer: true,
          },
        ],
        mockTx as never
      )

      expect(mockUpdateManyBatch).toHaveBeenCalledWith({
        where: {
          dependentId: { in: ['child-1'] },
          guardianId: { notIn: ['parent-1'] },
          isActive: true,
          isPrimaryPayer: true,
        },
        data: { isPrimaryPayer: false },
      })
    })

    it('should log warning when race condition detected', async () => {
      const { createGuardianRelationshipsBatch } = await import(
        '../registration-service'
      )

      mockFindMany.mockResolvedValue([])
      mockCreateMany.mockResolvedValue({ count: 1 })

      await createGuardianRelationshipsBatch(
        [
          {
            guardianPersonId: 'parent-1',
            dependentPersonId: 'child-1',
            role: 'PARENT',
            isPrimaryPayer: true,
          },
          {
            guardianPersonId: 'parent-2',
            dependentPersonId: 'child-1',
            role: 'PARENT',
            isPrimaryPayer: false,
          },
        ],
        mockTx as never
      )

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        {
          expected: 2,
          created: 1,
          skipped: 1,
        },
        'Some guardian relationships already existed (race condition detected)'
      )
    })

    it('should handle empty relationships array', async () => {
      const { createGuardianRelationshipsBatch } = await import(
        '../registration-service'
      )

      await createGuardianRelationshipsBatch([], mockTx as never)

      expect(mockFindMany).not.toHaveBeenCalled()
      expect(mockCreateMany).not.toHaveBeenCalled()
    })
  })
})
