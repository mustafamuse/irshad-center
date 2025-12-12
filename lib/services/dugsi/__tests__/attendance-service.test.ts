import { DugsiAttendanceStatus } from '@prisma/client'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ZodError } from 'zod'

import { ActionError } from '@/lib/errors/action-error'


const {
  mockPrismaTransaction,
  mockCreateSession,
  mockUpdateSession,
  mockFindUniqueSession,
  mockFindUniqueClass,
  mockFindManyEnrollments,
  mockUpsertRecord,
  mockLoggerInfo,
  mockLoggerError,
  mockLogError,
} = vi.hoisted(() => ({
  mockPrismaTransaction: vi.fn(),
  mockCreateSession: vi.fn(),
  mockUpdateSession: vi.fn(),
  mockFindUniqueSession: vi.fn(),
  mockFindUniqueClass: vi.fn(),
  mockFindManyEnrollments: vi.fn(),
  mockUpsertRecord: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      mockPrismaTransaction(fn),
    dugsiAttendanceSession: {
      create: (...args: unknown[]) => mockCreateSession(...args),
      update: (...args: unknown[]) => mockUpdateSession(...args),
      findUnique: (...args: unknown[]) => mockFindUniqueSession(...args),
    },
    dugsiClass: {
      findUnique: (...args: unknown[]) => mockFindUniqueClass(...args),
    },
    dugsiClassEnrollment: {
      findMany: (...args: unknown[]) => mockFindManyEnrollments(...args),
    },
    dugsiAttendanceRecord: {
      upsert: (...args: unknown[]) => mockUpsertRecord(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  logError: mockLogError,
}))

import {
  createAttendanceSession,
  markAttendance,
  closeSession,
  getStudentStats,
} from '../attendance-service'

const CLASS_ID = '11111111-1111-1111-1111-111111111111'
const TEACHER_ID = '22222222-2222-2222-2222-222222222222'
const SESSION_ID = '33333333-3333-3333-3333-333333333333'
const PROFILE_ID_1 = '44444444-4444-4444-4444-444444444444'
const PROFILE_ID_2 = '55555555-5555-5555-5555-555555555555'

describe('Dugsi Attendance Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createAttendanceSession', () => {
    it('should create a new attendance session', async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      mockFindUniqueClass.mockResolvedValue({
        id: CLASS_ID,
        name: 'Quran Basics',
        isActive: true,
      })

      mockFindUniqueSession.mockResolvedValue(null)

      const mockSession = {
        id: SESSION_ID,
        date: today,
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
        notes: null,
        isClosed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockCreateSession.mockResolvedValue(mockSession)

      const result = await createAttendanceSession({
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
      })

      expect(result.id).toBe(SESSION_ID)
      expect(mockFindUniqueClass).toHaveBeenCalledWith({
        where: { id: CLASS_ID },
      })
      expect(mockCreateSession).toHaveBeenCalled()
    })

    it('should throw error if class not found', async () => {
      mockFindUniqueClass.mockResolvedValue(null)

      await expect(
        createAttendanceSession({
          classId: CLASS_ID,
          teacherId: TEACHER_ID,
        })
      ).rejects.toThrow(ActionError)
    })

    it('should throw error if class is not active', async () => {
      mockFindUniqueClass.mockResolvedValue({
        id: CLASS_ID,
        name: 'Quran Basics',
        isActive: false,
      })

      await expect(
        createAttendanceSession({
          classId: CLASS_ID,
          teacherId: TEACHER_ID,
        })
      ).rejects.toThrow('Class is not active')
    })

    it('should throw error on P2002 (duplicate session)', async () => {
      mockFindUniqueClass.mockResolvedValue({
        id: CLASS_ID,
        name: 'Quran Basics',
        isActive: true,
      })

      const prismaError = new Error('Unique constraint failed')
      Object.assign(prismaError, { code: 'P2002' })
      mockCreateSession.mockRejectedValue(prismaError)

      await expect(
        createAttendanceSession({
          classId: CLASS_ID,
          teacherId: TEACHER_ID,
        })
      ).rejects.toThrow('Attendance session already exists')
    })

    it('should allow custom date for session', async () => {
      const customDate = new Date('2024-12-01')

      mockFindUniqueClass.mockResolvedValue({
        id: CLASS_ID,
        name: 'Quran Basics',
        isActive: true,
      })

      mockFindUniqueSession.mockResolvedValue(null)

      const mockSession = {
        id: SESSION_ID,
        date: customDate,
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
        notes: null,
        isClosed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockCreateSession.mockResolvedValue(mockSession)

      const result = await createAttendanceSession({
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
        date: customDate,
      })

      expect(result.date).toEqual(customDate)
    })
  })

  describe('markAttendance', () => {
    it('should mark attendance for multiple students', async () => {
      mockFindUniqueSession.mockResolvedValue({
        id: SESSION_ID,
        date: new Date(),
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
        isClosed: false,
      })

      mockFindManyEnrollments.mockResolvedValue([
        { programProfileId: PROFILE_ID_1 },
        { programProfileId: PROFILE_ID_2 },
      ])

      mockUpsertRecord.mockResolvedValue({ id: 'record-1' })

      mockPrismaTransaction.mockImplementation(async (fn) => {
        const tx = {
          dugsiAttendanceSession: {
            findUnique: mockFindUniqueSession,
          },
          dugsiClassEnrollment: {
            findMany: mockFindManyEnrollments,
          },
          dugsiAttendanceRecord: {
            upsert: mockUpsertRecord,
          },
        }
        return fn(tx)
      })

      const result = await markAttendance({
        sessionId: SESSION_ID,
        records: [
          {
            programProfileId: PROFILE_ID_1,
            status: DugsiAttendanceStatus.PRESENT,
            lessonCompleted: true,
            surahName: 'Al-Fatiha',
            ayatFrom: 1,
            ayatTo: 7,
          },
          {
            programProfileId: PROFILE_ID_2,
            status: DugsiAttendanceStatus.ABSENT,
          },
        ],
      })

      expect(result.markedCount).toBe(2)
    })

    it('should throw error if session not found', async () => {
      mockFindUniqueSession.mockResolvedValue(null)

      mockPrismaTransaction.mockImplementation(async (fn) => {
        const tx = {
          dugsiAttendanceSession: {
            findUnique: mockFindUniqueSession,
          },
        }
        return fn(tx)
      })

      await expect(
        markAttendance({
          sessionId: SESSION_ID,
          records: [
            {
              programProfileId: PROFILE_ID_1,
              status: DugsiAttendanceStatus.PRESENT,
            },
          ],
        })
      ).rejects.toThrow(ActionError)
    })

    it('should throw error if session is closed', async () => {
      mockFindUniqueSession.mockResolvedValue({
        id: SESSION_ID,
        date: new Date(),
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
        isClosed: true,
      })

      mockPrismaTransaction.mockImplementation(async (fn) => {
        const tx = {
          dugsiAttendanceSession: {
            findUnique: mockFindUniqueSession,
          },
        }
        return fn(tx)
      })

      await expect(
        markAttendance({
          sessionId: SESSION_ID,
          records: [
            {
              programProfileId: PROFILE_ID_1,
              status: DugsiAttendanceStatus.PRESENT,
            },
          ],
        })
      ).rejects.toThrow('Cannot mark attendance for a closed session')
    })

    it('should validate students belong to the class', async () => {
      mockFindUniqueSession.mockResolvedValue({
        id: SESSION_ID,
        date: new Date(),
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
        isClosed: false,
      })

      mockFindManyEnrollments.mockResolvedValue([
        { programProfileId: PROFILE_ID_1 },
      ])

      mockPrismaTransaction.mockImplementation(async (fn) => {
        const tx = {
          dugsiAttendanceSession: {
            findUnique: mockFindUniqueSession,
          },
          dugsiClassEnrollment: {
            findMany: mockFindManyEnrollments,
          },
        }
        return fn(tx)
      })

      await expect(
        markAttendance({
          sessionId: SESSION_ID,
          records: [
            {
              programProfileId: PROFILE_ID_2,
              status: DugsiAttendanceStatus.PRESENT,
            },
          ],
        })
      ).rejects.toThrow('not enrolled in this class')
    })

    it('should rollback entire transaction if any upsert fails', async () => {
      mockFindUniqueSession.mockResolvedValue({
        id: SESSION_ID,
        date: new Date(),
        classId: CLASS_ID,
        teacherId: TEACHER_ID,
        isClosed: false,
      })

      mockFindManyEnrollments.mockResolvedValue([
        { programProfileId: PROFILE_ID_1 },
        { programProfileId: PROFILE_ID_2 },
      ])

      mockUpsertRecord
        .mockResolvedValueOnce({ id: 'record-1' })
        .mockRejectedValueOnce(new Error('Database constraint violation'))

      mockPrismaTransaction.mockImplementation(async (fn) => {
        const tx = {
          dugsiAttendanceSession: {
            findUnique: mockFindUniqueSession,
          },
          dugsiClassEnrollment: {
            findMany: mockFindManyEnrollments,
          },
          dugsiAttendanceRecord: {
            upsert: mockUpsertRecord,
          },
        }
        return fn(tx)
      })

      await expect(
        markAttendance({
          sessionId: SESSION_ID,
          records: [
            {
              programProfileId: PROFILE_ID_1,
              status: DugsiAttendanceStatus.PRESENT,
            },
            {
              programProfileId: PROFILE_ID_2,
              status: DugsiAttendanceStatus.PRESENT,
            },
          ],
        })
      ).rejects.toThrow('Database constraint violation')
    })

    it('should reject invalid ayat range (ayatFrom > ayatTo)', async () => {
      await expect(
        markAttendance({
          sessionId: SESSION_ID,
          records: [
            {
              programProfileId: PROFILE_ID_1,
              status: DugsiAttendanceStatus.PRESENT,
              ayatFrom: 10,
              ayatTo: 5,
            },
          ],
        })
      ).rejects.toThrow(ZodError)
    })
  })

  describe('closeSession', () => {
    it('should close an open session', async () => {
      mockFindUniqueSession.mockResolvedValue({
        id: SESSION_ID,
        isClosed: false,
      })

      mockUpdateSession.mockResolvedValue({
        id: SESSION_ID,
        isClosed: true,
      })

      const result = await closeSession(SESSION_ID)

      expect(result.isClosed).toBe(true)
      expect(mockUpdateSession).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: { isClosed: true },
      })
    })

    it('should throw error if session not found', async () => {
      mockFindUniqueSession.mockResolvedValue(null)

      await expect(closeSession(SESSION_ID)).rejects.toThrow(ActionError)
    })

    it('should throw error if session already closed', async () => {
      mockFindUniqueSession.mockResolvedValue({
        id: SESSION_ID,
        isClosed: true,
      })

      await expect(closeSession(SESSION_ID)).rejects.toThrow(
        'Session is already closed'
      )
    })
  })

  describe('getStudentStats', () => {
    it('should calculate attendance statistics for a student', async () => {
      const mockRecords = [
        { status: DugsiAttendanceStatus.PRESENT, lessonCompleted: true },
        { status: DugsiAttendanceStatus.PRESENT, lessonCompleted: true },
        { status: DugsiAttendanceStatus.PRESENT, lessonCompleted: false },
        { status: DugsiAttendanceStatus.ABSENT, lessonCompleted: false },
        { status: DugsiAttendanceStatus.LATE, lessonCompleted: true },
      ]

      const mockClient = {
        dugsiAttendanceRecord: {
          findMany: vi.fn().mockResolvedValue(mockRecords),
        },
      }

      const stats = await getStudentStats(
        PROFILE_ID_1,
        {
          startDate: new Date('2024-12-01'),
          endDate: new Date('2024-12-31'),
        },
        mockClient as unknown as typeof prisma
      )

      expect(stats.totalSessions).toBe(5)
      expect(stats.presentCount).toBe(3)
      expect(stats.absentCount).toBe(1)
      expect(stats.lateCount).toBe(1)
      expect(stats.attendanceRate).toBe(60)
      expect(stats.lessonCompletionRate).toBe(75)
    })
  })
})
