import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockTeacherFindUnique,
  mockTeacherFindMany,
  mockClassTeacherFindFirst,
  mockTeacherProgramFindFirst,
  mockGuardianFindMany,
  mockBillingFindMany,
  mockProfileFindMany,
} = vi.hoisted(() => ({
  mockTeacherFindUnique: vi.fn(),
  mockTeacherFindMany: vi.fn(),
  mockClassTeacherFindFirst: vi.fn(),
  mockTeacherProgramFindFirst: vi.fn(),
  mockGuardianFindMany: vi.fn(),
  mockBillingFindMany: vi.fn(),
  mockProfileFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    teacher: {
      findUnique: (...args: unknown[]) => mockTeacherFindUnique(...args),
      findMany: (...args: unknown[]) => mockTeacherFindMany(...args),
    },
    dugsiClassTeacher: {
      findFirst: (...args: unknown[]) => mockClassTeacherFindFirst(...args),
    },
    teacherProgram: {
      findFirst: (...args: unknown[]) => mockTeacherProgramFindFirst(...args),
    },
    guardianRelationship: {
      findMany: (...args: unknown[]) => mockGuardianFindMany(...args),
    },
    billingAccount: {
      findMany: (...args: unknown[]) => mockBillingFindMany(...args),
    },
    programProfile: {
      findMany: (...args: unknown[]) => mockProfileFindMany(...args),
    },
  },
}))

import {
  getTeacherById,
  getTeacherByPersonId,
  getTeacherWithPersonRelations,
  getAllTeachers,
  isPersonATeacher,
  findTeachersByPhoneLastFour,
  getTeacherName,
  getPersonRoles,
} from '../teacher'

describe('teacher queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTeacherById', () => {
    it('returns teacher with person', async () => {
      const teacher = { id: 't1', person: { name: 'Test' } }
      mockTeacherFindUnique.mockResolvedValue(teacher)
      const result = await getTeacherById('t1')
      expect(result).toEqual(teacher)
      expect(mockTeacherFindUnique).toHaveBeenCalledWith({
        where: { id: 't1' },
        include: { person: true },
      })
    })

    it('returns null when not found', async () => {
      mockTeacherFindUnique.mockResolvedValue(null)
      expect(await getTeacherById('missing')).toBeNull()
    })
  })

  describe('getTeacherByPersonId', () => {
    it('queries by personId', async () => {
      mockTeacherFindUnique.mockResolvedValue({ id: 't1' })
      await getTeacherByPersonId('p1')
      expect(mockTeacherFindUnique).toHaveBeenCalledWith({
        where: { personId: 'p1' },
        include: { person: true },
      })
    })
  })

  describe('getTeacherWithPersonRelations', () => {
    it('includes contact points and relationships', async () => {
      const teacher = {
        id: 't1',
        person: {
          contactPoints: [],
          guardianRelationships: [],
          dependentRelationships: [],
        },
      }
      mockTeacherFindUnique.mockResolvedValue(teacher)
      const result = await getTeacherWithPersonRelations('t1')
      expect(result).toEqual(teacher)
    })
  })

  describe('getAllTeachers', () => {
    it('returns paginated teachers', async () => {
      mockTeacherFindMany.mockResolvedValue([])
      await getAllTeachers({ page: 2, limit: 10 })
      expect(mockTeacherFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      )
    })

    it('filters by search term', async () => {
      mockTeacherFindMany.mockResolvedValue([])
      await getAllTeachers({ search: 'Ali' })
      expect(mockTeacherFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { person: { name: { contains: 'Ali', mode: 'insensitive' } } },
        })
      )
    })

    it('uses default pagination', async () => {
      mockTeacherFindMany.mockResolvedValue([])
      await getAllTeachers()
      expect(mockTeacherFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 })
      )
    })
  })

  describe('isPersonATeacher', () => {
    it('returns true when teacher exists', async () => {
      mockTeacherFindUnique.mockResolvedValue({ id: 't1' })
      expect(await isPersonATeacher('p1')).toBe(true)
    })

    it('returns false when not a teacher', async () => {
      mockTeacherFindUnique.mockResolvedValue(null)
      expect(await isPersonATeacher('p1')).toBe(false)
    })
  })

  describe('findTeachersByPhoneLastFour', () => {
    it('queries with endsWith filter', async () => {
      mockTeacherFindMany.mockResolvedValue([])
      await findTeachersByPhoneLastFour('1234')
      expect(mockTeacherFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            person: {
              is: {
                contactPoints: {
                  some: {
                    type: 'PHONE',
                    isActive: true,
                    value: { endsWith: '1234' },
                  },
                },
              },
            },
          },
        })
      )
    })
  })

  describe('getTeacherName', () => {
    it('returns name when found', async () => {
      mockTeacherFindUnique.mockResolvedValue({ person: { name: 'Ali' } })
      expect(await getTeacherName('t1')).toBe('Ali')
    })

    it('returns null when not found', async () => {
      mockTeacherFindUnique.mockResolvedValue(null)
      expect(await getTeacherName('t1')).toBeNull()
    })
  })

  describe('getPersonRoles', () => {
    it('returns all roles', async () => {
      mockTeacherFindUnique.mockResolvedValue({ id: 't1' })
      mockProfileFindMany.mockResolvedValue([
        { program: 'DUGSI_PROGRAM', status: 'ACTIVE' },
      ])
      mockGuardianFindMany.mockResolvedValue([{ role: 'PARENT' }])
      mockBillingFindMany.mockResolvedValue([{ id: 'b1' }])

      const result = await getPersonRoles('p1')
      expect(result.isTeacher).toBe(true)
      expect(result.isStudent).toBe(true)
      expect(result.isGuardian).toBe(true)
      expect(result.isPayer).toBe(true)
      expect(result.studentPrograms).toEqual(['DUGSI_PROGRAM'])
      expect(result.guardianRoles).toEqual(['PARENT'])
    })

    it('returns false for all roles when nothing found', async () => {
      mockTeacherFindUnique.mockResolvedValue(null)
      mockProfileFindMany.mockResolvedValue([])
      mockGuardianFindMany.mockResolvedValue([])
      mockBillingFindMany.mockResolvedValue([])

      const result = await getPersonRoles('p1')
      expect(result.isTeacher).toBe(false)
      expect(result.isStudent).toBe(false)
      expect(result.isGuardian).toBe(false)
      expect(result.isPayer).toBe(false)
    })
  })
})
