import { Program, Shift } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

import { ValidationError } from '@/lib/services/validation-service'

const {
  mockFindMany,
  mockUpdateMany,
  mockUpsert,
  mockGroupBy,
  mockProfileFindMany,
  mockTransaction,
  mockTeacherFindUnique,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockUpsert: vi.fn(),
  mockGroupBy: vi.fn(),
  mockProfileFindMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockTeacherFindUnique: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    teacher: {
      findUnique: (...args: unknown[]) => mockTeacherFindUnique(...args),
    },
    teacherProgram: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    teacherAssignment: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
    programProfile: {
      findMany: (...args: unknown[]) => mockProfileFindMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
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

import {
  bulkAssignPrograms,
  validateShiftRequirement,
} from '../teacher-service'

describe('bulkAssignPrograms', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: teacher exists
    mockTeacherFindUnique.mockResolvedValue({ id: 'teacher-1' })

    mockTransaction.mockImplementation(async (callbackOrArray) => {
      if (typeof callbackOrArray === 'function') {
        const tx = {
          teacherProgram: {
            findMany: mockFindMany,
            updateMany: mockUpdateMany,
            upsert: mockUpsert,
          },
          teacherAssignment: {
            groupBy: mockGroupBy,
          },
          programProfile: {
            findMany: mockProfileFindMany,
          },
        }
        return callbackOrArray(tx)
      }
      return Promise.all(callbackOrArray)
    })
  })

  it('should activate programs in the input array', async () => {
    mockFindMany.mockResolvedValue([])
    mockGroupBy.mockResolvedValue([])
    mockUpsert.mockResolvedValue({
      id: 'tp-1',
      teacherId: 'teacher-1',
      program: Program.DUGSI_PROGRAM,
      shifts: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await bulkAssignPrograms('teacher-1', [Program.DUGSI_PROGRAM])

    expect(mockUpsert).toHaveBeenCalledWith({
      where: {
        teacherId_program: {
          teacherId: 'teacher-1',
          program: Program.DUGSI_PROGRAM,
        },
      },
      create: {
        teacherId: 'teacher-1',
        program: Program.DUGSI_PROGRAM,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    })
  })

  it('should deactivate programs not in the input array', async () => {
    mockFindMany.mockResolvedValue([
      { program: Program.DUGSI_PROGRAM },
      { program: Program.MAHAD_PROGRAM },
    ])
    mockGroupBy.mockResolvedValue([]) // No active assignments
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockUpsert.mockResolvedValue({
      id: 'tp-1',
      teacherId: 'teacher-1',
      program: Program.MAHAD_PROGRAM,
      shifts: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await bulkAssignPrograms('teacher-1', [Program.MAHAD_PROGRAM])

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        teacherId: 'teacher-1',
        program: { in: [Program.DUGSI_PROGRAM] },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    })

    expect(mockUpsert).toHaveBeenCalled()
  })

  it('should throw error when removing program with active students', async () => {
    mockFindMany.mockResolvedValue([{ program: Program.DUGSI_PROGRAM }])
    // Mock groupBy returning active assignments
    mockGroupBy.mockResolvedValue([
      { programProfileId: 'profile-1', _count: { _all: 5 } },
    ])
    // Mock programProfile.findMany to return the program for the profile
    mockProfileFindMany.mockResolvedValue([
      { id: 'profile-1', program: Program.DUGSI_PROGRAM },
    ])

    await expect(
      bulkAssignPrograms('teacher-1', [Program.MAHAD_PROGRAM])
    ).rejects.toThrow(
      'Cannot remove teacher from DUGSI_PROGRAM. They have 5 active student assignment(s). Please reassign students first.'
    )

    expect(mockUpdateMany).not.toHaveBeenCalled()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('should handle add and remove in single operation', async () => {
    mockFindMany.mockResolvedValue([{ program: Program.MAHAD_PROGRAM }])
    mockGroupBy.mockResolvedValue([]) // No active assignments
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockUpsert.mockResolvedValue({
      id: 'tp-1',
      teacherId: 'teacher-1',
      program: Program.DUGSI_PROGRAM,
      shifts: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await bulkAssignPrograms('teacher-1', [Program.DUGSI_PROGRAM])

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        teacherId: 'teacher-1',
        program: { in: [Program.MAHAD_PROGRAM] },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    })

    expect(mockUpsert).toHaveBeenCalled()
  })

  it('should reactivate previously removed program', async () => {
    mockFindMany.mockResolvedValue([{ program: Program.MAHAD_PROGRAM }])
    mockGroupBy.mockResolvedValue([])
    mockUpsert.mockResolvedValue({
      id: 'tp-1',
      teacherId: 'teacher-1',
      program: Program.DUGSI_PROGRAM,
      shifts: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await bulkAssignPrograms('teacher-1', [
      Program.MAHAD_PROGRAM,
      Program.DUGSI_PROGRAM,
    ])

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teacherId_program: {
            teacherId: 'teacher-1',
            program: Program.DUGSI_PROGRAM,
          },
        },
        update: {
          isActive: true,
        },
      })
    )
  })

  it('should not call updateMany if no programs to remove', async () => {
    mockFindMany.mockResolvedValue([{ program: Program.DUGSI_PROGRAM }])
    mockGroupBy.mockResolvedValue([])
    mockUpsert.mockResolvedValue({
      id: 'tp-1',
      teacherId: 'teacher-1',
      program: Program.DUGSI_PROGRAM,
      shifts: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await bulkAssignPrograms('teacher-1', [Program.DUGSI_PROGRAM])

    expect(mockUpdateMany).not.toHaveBeenCalled()
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('should throw error when programs array is empty', async () => {
    await expect(bulkAssignPrograms('teacher-1', [])).rejects.toThrow(
      'At least one program is required'
    )

    expect(mockFindMany).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('should throw error when duplicate programs provided', async () => {
    await expect(
      bulkAssignPrograms('teacher-1', [
        Program.DUGSI_PROGRAM,
        Program.DUGSI_PROGRAM,
      ])
    ).rejects.toThrow('Duplicate programs provided')

    expect(mockFindMany).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('should throw error when teacher not found', async () => {
    mockTeacherFindUnique.mockResolvedValue(null)

    await expect(
      bulkAssignPrograms('non-existent-teacher', [Program.DUGSI_PROGRAM])
    ).rejects.toThrow('Teacher not found')

    expect(mockTransaction).not.toHaveBeenCalled()
  })
})

describe('validateShiftRequirement', () => {
  it('should throw ValidationError when Dugsi assignment has no shift', () => {
    expect(() => validateShiftRequirement(Program.DUGSI_PROGRAM, null)).toThrow(
      ValidationError
    )

    expect(() => validateShiftRequirement(Program.DUGSI_PROGRAM, null)).toThrow(
      'Shift is required for Dugsi program assignments'
    )
  })

  it('should throw ValidationError when Dugsi assignment has undefined shift', () => {
    expect(() =>
      validateShiftRequirement(Program.DUGSI_PROGRAM, undefined)
    ).toThrow(ValidationError)
  })

  it('should accept MORNING shift for Dugsi assignments', () => {
    expect(() =>
      validateShiftRequirement(Program.DUGSI_PROGRAM, Shift.MORNING)
    ).not.toThrow()
  })

  it('should accept AFTERNOON shift for Dugsi assignments', () => {
    expect(() =>
      validateShiftRequirement(Program.DUGSI_PROGRAM, Shift.AFTERNOON)
    ).not.toThrow()
  })

  it('should allow null shift for Mahad assignments', () => {
    expect(() =>
      validateShiftRequirement(Program.MAHAD_PROGRAM, null)
    ).not.toThrow()
  })

  it('should throw error when shift provided for Mahad', () => {
    expect(() =>
      validateShiftRequirement(Program.MAHAD_PROGRAM, Shift.MORNING)
    ).toThrow('Shift should not be provided for non-Dugsi programs')
  })
})
