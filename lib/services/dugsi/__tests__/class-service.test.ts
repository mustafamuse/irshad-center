import { Shift } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockDugsiClassCreate,
  mockDugsiClassUpdate,
  mockDugsiClassFindUnique,
  mockDugsiClassEnrollmentCreate,
  mockDugsiClassEnrollmentUpdate,
  mockDugsiClassEnrollmentFindUnique,
  mockGetClassByStudentProfile,
  mockGetProgramProfileById,
  mockLoggerInfo,
  mockLogError,
} = vi.hoisted(() => ({
  mockDugsiClassCreate: vi.fn(),
  mockDugsiClassUpdate: vi.fn(),
  mockDugsiClassFindUnique: vi.fn(),
  mockDugsiClassEnrollmentCreate: vi.fn(),
  mockDugsiClassEnrollmentUpdate: vi.fn(),
  mockDugsiClassEnrollmentFindUnique: vi.fn(),
  mockGetClassByStudentProfile: vi.fn(),
  mockGetProgramProfileById: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    dugsiClass: {
      create: (...args: unknown[]) => mockDugsiClassCreate(...args),
      update: (...args: unknown[]) => mockDugsiClassUpdate(...args),
      findUnique: (...args: unknown[]) => mockDugsiClassFindUnique(...args),
    },
    dugsiClassEnrollment: {
      create: (...args: unknown[]) => mockDugsiClassEnrollmentCreate(...args),
      update: (...args: unknown[]) => mockDugsiClassEnrollmentUpdate(...args),
      findUnique: (...args: unknown[]) =>
        mockDugsiClassEnrollmentFindUnique(...args),
    },
  },
}))

vi.mock('@/lib/db/queries/dugsi-class', () => ({
  getClassByStudentProfile: (...args: unknown[]) =>
    mockGetClassByStudentProfile(...args),
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfileById: (...args: unknown[]) =>
    mockGetProgramProfileById(...args),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logError: mockLogError,
}))

import { ERROR_CODES } from '@/lib/errors/action-error'

import {
  createDugsiClass,
  updateDugsiClass,
  assignStudentToClass,
  removeStudentFromClass,
} from '../class-service'

const CLASS_ID = '11111111-1111-1111-1111-111111111111'
const CLASS_ID_2 = '22222222-2222-2222-2222-222222222222'
const PROFILE_ID = '33333333-3333-3333-3333-333333333333'
const PROFILE_ID_INVALID = '44444444-4444-4444-4444-444444444444'
const PERSON_ID = '55555555-5555-5555-5555-555555555555'
const ENROLLMENT_ID = '66666666-6666-6666-6666-666666666666'

describe('Dugsi Class Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createDugsiClass', () => {
    it('should create a new Dugsi class', async () => {
      const mockClass = {
        id: CLASS_ID,
        name: 'Quran Basics',
        shift: Shift.MORNING,
        description: 'Beginner level Quran class',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDugsiClassCreate.mockResolvedValue(mockClass)

      const input = {
        name: 'Quran Basics',
        shift: Shift.MORNING,
        description: 'Beginner level Quran class',
      }

      const result = await createDugsiClass(input)

      expect(result).toEqual(mockClass)
      expect(mockDugsiClassCreate).toHaveBeenCalledWith({
        data: {
          name: 'Quran Basics',
          shift: Shift.MORNING,
          description: 'Beginner level Quran class',
        },
      })
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Quran Basics' }),
        'Dugsi class created'
      )
    })

    it('should create class without description', async () => {
      const mockClass = {
        id: CLASS_ID,
        name: 'Quran Basics',
        shift: Shift.AFTERNOON,
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDugsiClassCreate.mockResolvedValue(mockClass)

      const input = {
        name: 'Quran Basics',
        shift: Shift.AFTERNOON,
      }

      const result = await createDugsiClass(input)

      expect(result.description).toBeNull()
      expect(mockDugsiClassCreate).toHaveBeenCalledWith({
        data: {
          name: 'Quran Basics',
          shift: Shift.AFTERNOON,
        },
      })
    })

    it('should throw error when database operation fails', async () => {
      const dbError = new Error('Database connection failed')
      mockDugsiClassCreate.mockRejectedValue(dbError)

      const input = {
        name: 'Quran Basics',
        shift: Shift.MORNING,
      }

      await expect(createDugsiClass(input)).rejects.toThrow(
        'Database connection failed'
      )
      expect(mockLogError).toHaveBeenCalled()
    })
  })

  describe('updateDugsiClass', () => {
    it('should update class details', async () => {
      const mockUpdatedClass = {
        id: CLASS_ID,
        name: 'Advanced Quran',
        shift: Shift.AFTERNOON,
        description: 'Updated description',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDugsiClassUpdate.mockResolvedValue(mockUpdatedClass)

      const input = {
        name: 'Advanced Quran',
        description: 'Updated description',
      }

      const result = await updateDugsiClass(CLASS_ID, input)

      expect(result).toEqual(mockUpdatedClass)
      expect(mockDugsiClassUpdate).toHaveBeenCalledWith({
        where: { id: CLASS_ID },
        data: input,
      })
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({ classId: CLASS_ID }),
        'Dugsi class updated'
      )
    })

    it('should deactivate a class', async () => {
      const mockDeactivatedClass = {
        id: CLASS_ID,
        name: 'Old Class',
        shift: Shift.MORNING,
        description: null,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDugsiClassUpdate.mockResolvedValue(mockDeactivatedClass)

      const result = await updateDugsiClass(CLASS_ID, { isActive: false })

      expect(result.isActive).toBe(false)
      expect(mockDugsiClassUpdate).toHaveBeenCalledWith({
        where: { id: CLASS_ID },
        data: { isActive: false },
      })
    })
  })

  describe('assignStudentToClass', () => {
    it('should assign student to class successfully', async () => {
      const mockProfile = {
        id: PROFILE_ID,
        program: 'DUGSI_PROGRAM',
        person: { id: PERSON_ID, name: 'Ahmed Omar' },
      }

      const mockClass = {
        id: CLASS_ID,
        name: 'Quran Basics',
        shift: Shift.MORNING,
        isActive: true,
      }

      const mockEnrollment = {
        id: ENROLLMENT_ID,
        classId: CLASS_ID,
        programProfileId: PROFILE_ID,
        startDate: new Date(),
        endDate: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockGetProgramProfileById.mockResolvedValue(mockProfile)
      mockDugsiClassFindUnique.mockResolvedValue(mockClass)
      mockGetClassByStudentProfile.mockResolvedValue(null)
      mockDugsiClassEnrollmentCreate.mockResolvedValue(mockEnrollment)

      const input = {
        classId: CLASS_ID,
        programProfileId: PROFILE_ID,
      }

      const result = await assignStudentToClass(input)

      expect(result).toEqual(mockEnrollment)
      expect(mockDugsiClassEnrollmentCreate).toHaveBeenCalledWith({
        data: {
          classId: CLASS_ID,
          programProfileId: PROFILE_ID,
        },
      })
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          classId: CLASS_ID,
          programProfileId: PROFILE_ID,
        }),
        'Student assigned to Dugsi class'
      )
    })

    it('should throw error when student not found', async () => {
      mockGetProgramProfileById.mockResolvedValue(null)

      const input = {
        classId: CLASS_ID,
        programProfileId: PROFILE_ID_INVALID,
      }

      await expect(assignStudentToClass(input)).rejects.toMatchObject({
        message: 'Student not found',
        code: ERROR_CODES.PROFILE_NOT_FOUND,
      })
    })

    it('should throw error when student is not a Dugsi student', async () => {
      const mockProfile = {
        id: PROFILE_ID,
        program: 'MAHAD_PROGRAM',
        person: { id: PERSON_ID, name: 'Ahmed Omar' },
      }

      mockGetProgramProfileById.mockResolvedValue(mockProfile)

      const input = {
        classId: CLASS_ID,
        programProfileId: PROFILE_ID,
      }

      await expect(assignStudentToClass(input)).rejects.toMatchObject({
        message: 'Student is not enrolled in Dugsi program',
        code: ERROR_CODES.VALIDATION_ERROR,
      })
    })

    it('should throw error when class not found', async () => {
      const mockProfile = {
        id: PROFILE_ID,
        program: 'DUGSI_PROGRAM',
        person: { id: PERSON_ID, name: 'Ahmed Omar' },
      }

      mockGetProgramProfileById.mockResolvedValue(mockProfile)
      mockDugsiClassFindUnique.mockResolvedValue(null)

      const input = {
        classId: CLASS_ID_2,
        programProfileId: PROFILE_ID,
      }

      await expect(assignStudentToClass(input)).rejects.toMatchObject({
        message: 'Dugsi class not found',
        code: ERROR_CODES.NOT_FOUND,
      })
    })

    it('should throw error when class is inactive', async () => {
      const mockProfile = {
        id: PROFILE_ID,
        program: 'DUGSI_PROGRAM',
        person: { id: PERSON_ID, name: 'Ahmed Omar' },
      }

      const mockClass = {
        id: CLASS_ID,
        name: 'Old Class',
        shift: Shift.MORNING,
        isActive: false,
      }

      mockGetProgramProfileById.mockResolvedValue(mockProfile)
      mockDugsiClassFindUnique.mockResolvedValue(mockClass)

      const input = {
        classId: CLASS_ID,
        programProfileId: PROFILE_ID,
      }

      await expect(assignStudentToClass(input)).rejects.toMatchObject({
        message: 'Cannot assign student to inactive class',
        code: ERROR_CODES.VALIDATION_ERROR,
      })
    })

    it('should throw error when student already enrolled (P2002 unique constraint)', async () => {
      const mockProfile = {
        id: PROFILE_ID,
        program: 'DUGSI_PROGRAM',
        person: { id: PERSON_ID, name: 'Ahmed Omar' },
      }

      const mockClass = {
        id: CLASS_ID,
        name: 'Quran Basics',
        shift: Shift.MORNING,
        isActive: true,
      }

      const existingEnrollment = {
        id: ENROLLMENT_ID,
        classId: CLASS_ID_2,
        class: { id: CLASS_ID_2, name: 'Other Class' },
        programProfileId: PROFILE_ID,
        isActive: true,
      }

      const prismaError = new Error('Unique constraint failed')
      Object.assign(prismaError, { code: 'P2002' })

      mockGetProgramProfileById.mockResolvedValue(mockProfile)
      mockDugsiClassFindUnique.mockResolvedValue(mockClass)
      mockDugsiClassEnrollmentCreate.mockRejectedValue(prismaError)
      mockGetClassByStudentProfile.mockResolvedValue(existingEnrollment)

      const input = {
        classId: CLASS_ID,
        programProfileId: PROFILE_ID,
      }

      await expect(assignStudentToClass(input)).rejects.toMatchObject({
        message: 'Student is already enrolled in class: Other Class',
        code: ERROR_CODES.VALIDATION_ERROR,
      })
    })
  })

  describe('removeStudentFromClass', () => {
    it('should remove student from class by setting endDate', async () => {
      const mockEnrollment = {
        id: ENROLLMENT_ID,
        classId: CLASS_ID,
        programProfileId: PROFILE_ID,
        startDate: new Date('2024-01-01'),
        endDate: null,
        isActive: true,
      }

      const mockUpdatedEnrollment = {
        ...mockEnrollment,
        endDate: new Date(),
        isActive: false,
      }

      mockDugsiClassEnrollmentFindUnique.mockResolvedValue(mockEnrollment)
      mockDugsiClassEnrollmentUpdate.mockResolvedValue(mockUpdatedEnrollment)

      const result = await removeStudentFromClass(ENROLLMENT_ID)

      expect(result.isActive).toBe(false)
      expect(result.endDate).not.toBeNull()
      expect(mockDugsiClassEnrollmentUpdate).toHaveBeenCalledWith({
        where: { id: ENROLLMENT_ID },
        data: {
          isActive: false,
          endDate: expect.any(Date),
        },
      })
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.objectContaining({ enrollmentId: ENROLLMENT_ID }),
        'Student removed from Dugsi class'
      )
    })

    it('should throw error when enrollment not found', async () => {
      mockDugsiClassEnrollmentFindUnique.mockResolvedValue(null)

      await expect(removeStudentFromClass(ENROLLMENT_ID)).rejects.toMatchObject(
        {
          message: 'Class enrollment not found',
          code: ERROR_CODES.NOT_FOUND,
        }
      )
    })
  })
})
