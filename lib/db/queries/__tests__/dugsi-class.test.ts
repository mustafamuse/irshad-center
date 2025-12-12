import { Shift } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockDugsiClassFindMany,
  mockDugsiClassFindUnique,
  mockDugsiClassEnrollmentFindMany,
} = vi.hoisted(() => ({
  mockDugsiClassFindMany: vi.fn(),
  mockDugsiClassFindUnique: vi.fn(),
  mockDugsiClassEnrollmentFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    dugsiClass: {
      findMany: (...args: unknown[]) => mockDugsiClassFindMany(...args),
      findUnique: (...args: unknown[]) => mockDugsiClassFindUnique(...args),
    },
    dugsiClassEnrollment: {
      findMany: (...args: unknown[]) =>
        mockDugsiClassEnrollmentFindMany(...args),
    },
  },
}))

import {
  getAllDugsiClasses,
  getDugsiClassById,
  getDugsiClassesByShift,
  getStudentsInClass,
  getClassByStudentProfile,
} from '../dugsi-class'

describe('Dugsi Class Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllDugsiClasses', () => {
    it('should return all active classes with student counts', async () => {
      const mockClasses = [
        {
          id: 'class-1',
          name: 'Quran Basics',
          shift: Shift.MORNING,
          description: null,
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          _count: { students: 10 },
        },
      ]
      mockDugsiClassFindMany.mockResolvedValue(mockClasses)

      const result = await getAllDugsiClasses()

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Quran Basics')
      expect(result[0].studentCount).toBe(10)
      expect(result[0].shift).toBe(Shift.MORNING)
      expect(mockDugsiClassFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      )
    })

    it('should filter by active status when specified', async () => {
      mockDugsiClassFindMany.mockResolvedValue([])

      await getAllDugsiClasses({ activeOnly: true })

      expect(mockDugsiClassFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      )
    })

    it('should filter by shift when specified', async () => {
      mockDugsiClassFindMany.mockResolvedValue([])

      await getAllDugsiClasses({ shift: Shift.AFTERNOON })

      expect(mockDugsiClassFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ shift: Shift.AFTERNOON }),
        })
      )
    })

    it('should include inactive classes when activeOnly is false', async () => {
      mockDugsiClassFindMany.mockResolvedValue([])

      await getAllDugsiClasses({ activeOnly: false })

      expect(mockDugsiClassFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      )
    })
  })

  describe('getDugsiClassById', () => {
    it('should return class DTO when found', async () => {
      const mockClass = {
        id: 'class-1',
        name: 'Quran Basics',
        shift: Shift.MORNING,
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { students: 5 },
      }
      mockDugsiClassFindUnique.mockResolvedValue(mockClass)

      const result = await getDugsiClassById('class-1')

      expect(result?.id).toBe('class-1')
      expect(result?.name).toBe('Quran Basics')
      expect(result?.studentCount).toBe(5)
      expect(mockDugsiClassFindUnique).toHaveBeenCalledWith({
        where: { id: 'class-1' },
        include: {
          _count: { select: { students: { where: { isActive: true } } } },
        },
      })
    })

    it('should return null when class not found', async () => {
      mockDugsiClassFindUnique.mockResolvedValue(null)

      const result = await getDugsiClassById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getDugsiClassesByShift', () => {
    it('should return classes for specified shift', async () => {
      const mockClasses = [
        {
          id: 'class-1',
          name: 'Morning Class',
          shift: Shift.MORNING,
          description: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { students: 5 },
        },
      ]
      mockDugsiClassFindMany.mockResolvedValue(mockClasses)

      const result = await getDugsiClassesByShift(Shift.MORNING)

      expect(result).toHaveLength(1)
      expect(result[0].shift).toBe(Shift.MORNING)
      expect(mockDugsiClassFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shift: Shift.MORNING,
            isActive: true,
          }),
        })
      )
    })
  })

  describe('getStudentsInClass', () => {
    it('should return enrolled students for class', async () => {
      const mockEnrollments = [
        {
          id: 'enrollment-1',
          classId: 'class-1',
          programProfileId: 'profile-1',
          startDate: new Date(),
          endDate: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          programProfile: {
            id: 'profile-1',
            person: { id: 'person-1', name: 'Ahmed Omar' },
          },
        },
      ]
      mockDugsiClassEnrollmentFindMany.mockResolvedValue(mockEnrollments)

      const result = await getStudentsInClass('class-1')

      expect(result).toHaveLength(1)
      expect(result[0].studentName).toBe('Ahmed Omar')
      expect(mockDugsiClassEnrollmentFindMany).toHaveBeenCalledWith({
        where: { classId: 'class-1', isActive: true },
        include: expect.objectContaining({
          programProfile: expect.any(Object),
        }),
        orderBy: { programProfile: { person: { name: 'asc' } } },
      })
    })
  })

  describe('getClassByStudentProfile', () => {
    it('should return class enrollment for student', async () => {
      const mockEnrollment = {
        id: 'enrollment-1',
        classId: 'class-1',
        programProfileId: 'profile-1',
        startDate: new Date(),
        endDate: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        class: {
          id: 'class-1',
          name: 'Quran Basics',
          shift: Shift.MORNING,
          description: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }
      mockDugsiClassEnrollmentFindMany.mockResolvedValue([mockEnrollment])

      const result = await getClassByStudentProfile('profile-1')

      expect(result?.class.name).toBe('Quran Basics')
      expect(mockDugsiClassEnrollmentFindMany).toHaveBeenCalledWith({
        where: { programProfileId: 'profile-1', isActive: true },
        include: { class: true },
        take: 1,
      })
    })

    it('should return null when student not enrolled in any class', async () => {
      mockDugsiClassEnrollmentFindMany.mockResolvedValue([])

      const result = await getClassByStudentProfile('profile-no-class')

      expect(result).toBeNull()
    })
  })
})
