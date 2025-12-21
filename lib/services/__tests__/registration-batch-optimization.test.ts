/**
 * Registration Batch Optimization Tests
 *
 * TDD tests for batch lookup helpers and Phase 3 optimization
 * to fix connection pool timeout issues.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockPersonFindMany,
  mockProgramProfileFindMany,
  mockPersonCreate,
  mockPersonFindFirst,
  mockProgramProfileFindFirst,
  mockProgramProfileCreate,
  mockProgramProfileUpdate,
  mockEnrollmentFindFirst,
  mockEnrollmentCreate,
} = vi.hoisted(() => ({
  mockPersonFindMany: vi.fn(),
  mockProgramProfileFindMany: vi.fn(),
  mockPersonCreate: vi.fn(),
  mockPersonFindFirst: vi.fn(),
  mockProgramProfileFindFirst: vi.fn(),
  mockProgramProfileCreate: vi.fn(),
  mockProgramProfileUpdate: vi.fn(),
  mockEnrollmentFindFirst: vi.fn(),
  mockEnrollmentCreate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      findMany: (...args: unknown[]) => mockPersonFindMany(...args),
      create: (...args: unknown[]) => mockPersonCreate(...args),
      findFirst: (...args: unknown[]) => mockPersonFindFirst(...args),
    },
    programProfile: {
      findMany: (...args: unknown[]) => mockProgramProfileFindMany(...args),
      findFirst: (...args: unknown[]) => mockProgramProfileFindFirst(...args),
      create: (...args: unknown[]) => mockProgramProfileCreate(...args),
      update: (...args: unknown[]) => mockProgramProfileUpdate(...args),
    },
    enrollment: {
      findFirst: (...args: unknown[]) => mockEnrollmentFindFirst(...args),
      create: (...args: unknown[]) => mockEnrollmentCreate(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

describe('Batch Lookup Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findExistingChildren', () => {
    it('should batch lookup multiple children by name and DOB', async () => {
      const { findExistingChildren } = await import('../registration-service')

      const today = new Date('2020-01-01')
      const yesterday = new Date('2020-01-02')

      mockPersonFindMany.mockResolvedValue([
        { id: 'person-1', name: 'John Doe', dateOfBirth: today },
        { id: 'person-2', name: 'Jane Smith', dateOfBirth: yesterday },
      ])

      const children = [
        { firstName: 'John', lastName: 'Doe', dateOfBirth: today },
        { firstName: 'Jane', lastName: 'Smith', dateOfBirth: yesterday },
        { firstName: 'New', lastName: 'Child', dateOfBirth: today },
      ]

      const result = await findExistingChildren(children)

      expect(mockPersonFindMany).toHaveBeenCalledTimes(1)
      expect(mockPersonFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              name: { equals: 'John Doe', mode: 'insensitive' },
              dateOfBirth: { equals: today },
            },
            {
              name: { equals: 'Jane Smith', mode: 'insensitive' },
              dateOfBirth: { equals: yesterday },
            },
            {
              name: { equals: 'New Child', mode: 'insensitive' },
              dateOfBirth: { equals: today },
            },
          ],
        },
        select: { id: true, name: true, dateOfBirth: true },
      })

      expect(result.size).toBe(2)
      expect(result.get(`John Doe|${today.toISOString()}`)).toEqual({
        id: 'person-1',
        name: 'John Doe',
      })
      expect(result.get(`Jane Smith|${yesterday.toISOString()}`)).toEqual({
        id: 'person-2',
        name: 'Jane Smith',
      })
    })

    it('should return empty Map when no children have DOB', async () => {
      const { findExistingChildren } = await import('../registration-service')

      const children = [
        { firstName: 'John', lastName: 'Doe', dateOfBirth: null },
        { firstName: 'Jane', lastName: 'Smith', dateOfBirth: undefined },
      ]

      const result = await findExistingChildren(children)

      expect(mockPersonFindMany).not.toHaveBeenCalled()
      expect(result.size).toBe(0)
    })

    it('should use case-insensitive name matching', async () => {
      const { findExistingChildren } = await import('../registration-service')

      const dob = new Date('2020-01-01')

      mockPersonFindMany.mockResolvedValue([
        { id: 'person-1', name: 'John Doe', dateOfBirth: dob },
      ])

      const children = [
        { firstName: 'john', lastName: 'doe', dateOfBirth: dob },
      ]

      const result = await findExistingChildren(children)

      expect(mockPersonFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              name: { equals: 'john doe', mode: 'insensitive' },
              dateOfBirth: { equals: dob },
            },
          ],
        },
        select: { id: true, name: true, dateOfBirth: true },
      })

      expect(result.size).toBe(1)
      expect(result.get(`John Doe|${dob.toISOString()}`)).toEqual({
        id: 'person-1',
        name: 'John Doe',
      })
    })

    it('should handle empty children array', async () => {
      const { findExistingChildren } = await import('../registration-service')

      const result = await findExistingChildren([])

      expect(mockPersonFindMany).not.toHaveBeenCalled()
      expect(result.size).toBe(0)
    })

    it('should handle mixed valid and invalid DOB', async () => {
      const { findExistingChildren } = await import('../registration-service')

      const validDob = new Date('2020-01-01')

      mockPersonFindMany.mockResolvedValue([
        { id: 'person-1', name: 'Valid Child', dateOfBirth: validDob },
      ])

      const children = [
        { firstName: 'Valid', lastName: 'Child', dateOfBirth: validDob },
        { firstName: 'Invalid', lastName: 'Child', dateOfBirth: null },
        {
          firstName: 'Another',
          lastName: 'Invalid',
          dateOfBirth: undefined,
        },
      ]

      const result = await findExistingChildren(children)

      expect(mockPersonFindMany).toHaveBeenCalledTimes(1)
      expect(mockPersonFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              name: { equals: 'Valid Child', mode: 'insensitive' },
              dateOfBirth: { equals: validDob },
            },
          ],
        },
        select: { id: true, name: true, dateOfBirth: true },
      })

      expect(result.size).toBe(1)
    })
  })

  describe('findExistingProfiles', () => {
    it('should batch lookup profiles for multiple person IDs', async () => {
      const { findExistingProfiles } = await import('../registration-service')

      mockProgramProfileFindMany.mockResolvedValue([
        { id: 'profile-1', personId: 'person-1', program: 'DUGSI_PROGRAM' },
        { id: 'profile-2', personId: 'person-2', program: 'DUGSI_PROGRAM' },
        { id: 'profile-3', personId: 'person-3', program: 'DUGSI_PROGRAM' },
      ])

      const personIds = ['person-1', 'person-2', 'person-3']

      const result = await findExistingProfiles(personIds)

      expect(mockProgramProfileFindMany).toHaveBeenCalledTimes(1)
      expect(mockProgramProfileFindMany).toHaveBeenCalledWith({
        where: {
          personId: { in: personIds },
          program: 'DUGSI_PROGRAM',
        },
      })

      expect(result.size).toBe(3)
      expect(result.get('person-1')).toEqual({
        id: 'profile-1',
        personId: 'person-1',
        program: 'DUGSI_PROGRAM',
      })
    })

    it('should only return DUGSI_PROGRAM profiles', async () => {
      const { findExistingProfiles } = await import('../registration-service')

      mockProgramProfileFindMany.mockResolvedValue([
        { id: 'profile-1', personId: 'person-1', program: 'DUGSI_PROGRAM' },
      ])

      const result = await findExistingProfiles(['person-1'])

      expect(mockProgramProfileFindMany).toHaveBeenCalledWith({
        where: {
          personId: { in: ['person-1'] },
          program: 'DUGSI_PROGRAM',
        },
      })

      expect(result.size).toBe(1)
    })

    it('should return empty Map for empty person IDs array', async () => {
      const { findExistingProfiles } = await import('../registration-service')

      const result = await findExistingProfiles([])

      expect(mockProgramProfileFindMany).not.toHaveBeenCalled()
      expect(result.size).toBe(0)
    })

    it('should handle partial matches correctly', async () => {
      const { findExistingProfiles } = await import('../registration-service')

      mockProgramProfileFindMany.mockResolvedValue([
        { id: 'profile-1', personId: 'person-1', program: 'DUGSI_PROGRAM' },
      ])

      const result = await findExistingProfiles([
        'person-1',
        'person-2',
        'person-3',
      ])

      expect(result.size).toBe(1)
      expect(result.get('person-1')).toBeDefined()
      expect(result.get('person-2')).toBeUndefined()
      expect(result.get('person-3')).toBeUndefined()
    })

    it('should batch lookup profiles for both existing and newly created children', async () => {
      const { findExistingProfiles } = await import('../registration-service')

      mockProgramProfileFindMany.mockResolvedValue([
        {
          id: 'profile-1',
          personId: 'existing-person-1',
          program: 'DUGSI_PROGRAM',
        },
        {
          id: 'profile-2',
          personId: 'existing-person-2',
          program: 'DUGSI_PROGRAM',
        },
        { id: 'profile-3', personId: 'new-person-1', program: 'DUGSI_PROGRAM' },
      ])

      const allPersonIds = [
        'existing-person-1',
        'existing-person-2',
        'new-person-1',
        'new-person-2',
      ]

      const result = await findExistingProfiles(allPersonIds)

      expect(mockProgramProfileFindMany).toHaveBeenCalledTimes(1)
      expect(mockProgramProfileFindMany).toHaveBeenCalledWith({
        where: {
          personId: { in: allPersonIds },
          program: 'DUGSI_PROGRAM',
        },
      })

      expect(result.size).toBe(3)
      expect(result.get('existing-person-1')).toBeDefined()
      expect(result.get('existing-person-2')).toBeDefined()
      expect(result.get('new-person-1')).toBeDefined()
      expect(result.get('new-person-2')).toBeUndefined()
    })
  })
})
