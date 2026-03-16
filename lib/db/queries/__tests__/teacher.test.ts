import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockTeacherFindUnique, mockTeacherFindMany } = vi.hoisted(() => ({
  mockTeacherFindUnique: vi.fn(),
  mockTeacherFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    teacher: {
      findUnique: mockTeacherFindUnique,
      findMany: mockTeacherFindMany,
    },
  },
}))

import {
  getTeacherById,
  getTeacherByPersonId,
  getTeacherWithPersonRelations,
  getAllTeachers,
} from '../teacher'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getTeacherById', () => {
  it('should use relationLoadStrategy join', async () => {
    mockTeacherFindUnique.mockResolvedValue(null)

    await getTeacherById('t1')

    expect(mockTeacherFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getTeacherByPersonId', () => {
  it('should use relationLoadStrategy join', async () => {
    mockTeacherFindUnique.mockResolvedValue(null)

    await getTeacherByPersonId('p1')

    expect(mockTeacherFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getTeacherWithPersonRelations', () => {
  it('should use relationLoadStrategy join', async () => {
    mockTeacherFindUnique.mockResolvedValue(null)

    await getTeacherWithPersonRelations('t1')

    expect(mockTeacherFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})

describe('getAllTeachers', () => {
  it('should use relationLoadStrategy join', async () => {
    mockTeacherFindMany.mockResolvedValue([])

    await getAllTeachers()

    expect(mockTeacherFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        relationLoadStrategy: 'join',
      })
    )
  })
})
