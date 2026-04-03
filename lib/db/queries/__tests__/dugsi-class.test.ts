import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockDugsiClassFindMany,
  mockDugsiClassFindUnique,
  mockTeacherFindMany,
  mockProgramProfileFindMany,
  mockDugsiClassTeacherGroupBy,
  mockDugsiClassTeacherFindMany,
  mockDugsiClassTeacherCount,
} = vi.hoisted(() => ({
  mockDugsiClassFindMany: vi.fn(),
  mockDugsiClassFindUnique: vi.fn(),
  mockTeacherFindMany: vi.fn(),
  mockProgramProfileFindMany: vi.fn(),
  mockDugsiClassTeacherGroupBy: vi.fn(),
  mockDugsiClassTeacherFindMany: vi.fn(),
  mockDugsiClassTeacherCount: vi.fn(),
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
    dugsiClassTeacher: {
      groupBy: mockDugsiClassTeacherGroupBy,
      findMany: mockDugsiClassTeacherFindMany,
      count: mockDugsiClassTeacherCount,
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
  getClassCountsByTeacherIds,
  getActiveClassesForTeacher,
  countActiveClassesForTeacher,
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

describe('getClassCountsByTeacherIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should group by teacherId', async () => {
    mockDugsiClassTeacherGroupBy.mockResolvedValue([])

    await getClassCountsByTeacherIds(['t1', 't2'])

    expect(mockDugsiClassTeacherGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['teacherId'] })
    )
  })

  it('should filter by isActive true', async () => {
    mockDugsiClassTeacherGroupBy.mockResolvedValue([])

    await getClassCountsByTeacherIds(['t1'])

    expect(mockDugsiClassTeacherGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    )
  })

  it('should filter by provided teacherIds', async () => {
    mockDugsiClassTeacherGroupBy.mockResolvedValue([])

    await getClassCountsByTeacherIds(['t1', 't2'])

    expect(mockDugsiClassTeacherGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teacherId: { in: ['t1', 't2'] },
        }),
      })
    )
  })

  it('should return Map with correct counts', async () => {
    mockDugsiClassTeacherGroupBy.mockResolvedValue([
      { teacherId: 't1', _count: { id: 3 } },
    ])

    const result = await getClassCountsByTeacherIds(['t1', 't2'])

    expect(result.get('t1')).toBe(3)
  })

  it('should return empty Map for empty results', async () => {
    mockDugsiClassTeacherGroupBy.mockResolvedValue([])

    const result = await getClassCountsByTeacherIds([])

    expect(result.size).toBe(0)
  })
})

describe('getActiveClassesForTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use relationLoadStrategy join', async () => {
    mockDugsiClassTeacherFindMany.mockResolvedValue([])

    await getActiveClassesForTeacher('t1')

    expect(mockDugsiClassTeacherFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ relationLoadStrategy: 'join' })
    )
  })

  it('should filter by teacherId and isActive', async () => {
    mockDugsiClassTeacherFindMany.mockResolvedValue([])

    await getActiveClassesForTeacher('t1')

    expect(mockDugsiClassTeacherFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teacherId: 't1', isActive: true },
      })
    )
  })

  it('should include class name and shift', async () => {
    mockDugsiClassTeacherFindMany.mockResolvedValue([])

    await getActiveClassesForTeacher('t1')

    expect(mockDugsiClassTeacherFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { class: { select: { name: true, shift: true } } },
      })
    )
  })
})

describe('countActiveClassesForTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should filter by teacherId and isActive', async () => {
    mockDugsiClassTeacherCount.mockResolvedValue(0)

    await countActiveClassesForTeacher('t1')

    expect(mockDugsiClassTeacherCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teacherId: 't1', isActive: true },
      })
    )
  })

  it('should return 0 when no active classes', async () => {
    mockDugsiClassTeacherCount.mockResolvedValue(0)

    const result = await countActiveClassesForTeacher('t1')

    expect(result).toBe(0)
  })
})
