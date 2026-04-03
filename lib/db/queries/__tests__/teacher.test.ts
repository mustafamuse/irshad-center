import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockTeacherFindUnique,
  mockTeacherFindMany,
  mockTeacherProgramFindFirst,
  mockTeacherProgramUpdate,
} = vi.hoisted(() => ({
  mockTeacherFindUnique: vi.fn(),
  mockTeacherFindMany: vi.fn(),
  mockTeacherProgramFindFirst: vi.fn(),
  mockTeacherProgramUpdate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    teacher: {
      findUnique: mockTeacherFindUnique,
      findMany: mockTeacherFindMany,
    },
    teacherProgram: {
      findFirst: mockTeacherProgramFindFirst,
      update: mockTeacherProgramUpdate,
    },
  },
}))

import {
  getTeacherById,
  getTeacherByPersonId,
  getTeacherWithPersonRelations,
  getAllTeachers,
  getTeacherDugsiProgram,
  updateTeacherProgramShifts,
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

describe('getTeacherDugsiProgram', () => {
  it('should filter by teacherId, DUGSI_PROGRAM, and isActive', async () => {
    mockTeacherProgramFindFirst.mockResolvedValue(null)

    await getTeacherDugsiProgram('t1')

    expect(mockTeacherProgramFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teacherId: 't1', program: 'DUGSI_PROGRAM', isActive: true },
      })
    )
  })

  it('should return null when not found', async () => {
    mockTeacherProgramFindFirst.mockResolvedValue(null)

    const result = await getTeacherDugsiProgram('t1')

    expect(result).toBeNull()
  })

  it('should return record unchanged when found', async () => {
    const record = {
      id: 'tp-1',
      teacherId: 't1',
      program: 'DUGSI_PROGRAM',
      isActive: true,
      shifts: [],
    }
    mockTeacherProgramFindFirst.mockResolvedValue(record)

    const result = await getTeacherDugsiProgram('t1')

    expect(result).toBe(record)
  })
})

describe('updateTeacherProgramShifts', () => {
  it('should update by teacherProgramId', async () => {
    mockTeacherProgramUpdate.mockResolvedValue({})

    await updateTeacherProgramShifts('tp-1', ['MORNING'])

    expect(mockTeacherProgramUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tp-1' },
      })
    )
  })

  it('should pass shifts as data', async () => {
    mockTeacherProgramUpdate.mockResolvedValue({})

    await updateTeacherProgramShifts('tp-1', ['MORNING'])

    expect(mockTeacherProgramUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { shifts: ['MORNING'] },
      })
    )
  })

  it('should accept empty shifts array', async () => {
    mockTeacherProgramUpdate.mockResolvedValue({})

    await updateTeacherProgramShifts('tp-1', [])

    expect(mockTeacherProgramUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { shifts: [] },
      })
    )
  })
})
