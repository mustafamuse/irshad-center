import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockDugsiClassFindMany,
  mockDugsiClassFindUnique,
  mockTeacherFindMany,
  mockProgramProfileFindMany,
} = vi.hoisted(() => ({
  mockDugsiClassFindMany: vi.fn(),
  mockDugsiClassFindUnique: vi.fn(),
  mockTeacherFindMany: vi.fn(),
  mockProgramProfileFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    dugsiClass: {
      findMany: mockDugsiClassFindMany,
      findUnique: mockDugsiClassFindUnique,
    },
    teacher: {
      findMany: mockTeacherFindMany,
    },
    programProfile: {
      findMany: mockProgramProfileFindMany,
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
  logError: vi.fn(),
}))

import {
  getClassesWithDetails,
  getAllTeachersForAssignment,
  getAvailableStudentsForClass,
  getClassById,
  getClassPreviewForDelete,
} from '../dugsi-class'

describe('dugsi-class queries use relationLoadStrategy: join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getClassesWithDetails', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockDugsiClassFindMany.mockResolvedValue([])

      await getClassesWithDetails()

      expect(mockDugsiClassFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getAllTeachersForAssignment', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockTeacherFindMany.mockResolvedValue([])

      await getAllTeachersForAssignment()

      expect(mockTeacherFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getAvailableStudentsForClass', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockProgramProfileFindMany.mockResolvedValue([])

      await getAvailableStudentsForClass('MORNING')

      expect(mockProgramProfileFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getClassById', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockDugsiClassFindUnique.mockResolvedValue(null)

      await getClassById('class-1')

      expect(mockDugsiClassFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getClassPreviewForDelete', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockDugsiClassFindUnique.mockResolvedValue(null)

      await getClassPreviewForDelete('class-1')

      expect(mockDugsiClassFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })
})
