import { Prisma, DugsiAttendanceStatus } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetSessionById,
  mockCreate,
  mockUpsert,
  mockDelete,
  mockDeleteMany,
  mockFindUnique,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetSessionById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpsert: vi.fn(),
  mockDelete: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    dugsiClass: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    dugsiAttendanceSession: {
      create: (...args: unknown[]) => mockCreate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    dugsiAttendanceRecord: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      mockTransaction(fn),
  },
}))

vi.mock('@/lib/db/queries/dugsi-attendance', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/db/queries/dugsi-attendance')>()
  return {
    ...actual,
    getSessionById: (...args: unknown[]) => mockGetSessionById(...args),
  }
})

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import { ValidationError } from '@/lib/services/validation-service'

import {
  createAttendanceSession,
  markAttendanceRecords,
  deleteAttendanceSession,
  ATTENDANCE_ERROR_CODES,
} from '../attendance-service'

const mockSession = {
  id: 'session-1',
  classId: 'class-1',
  teacherId: 'teacher-1',
  date: new Date('2025-01-01'),
  notes: null,
  isClosed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  class: { id: 'class-1', name: 'Class A', shift: 'MORNING' },
  teacher: { id: 'teacher-1', person: { id: 'person-1', name: 'Teacher One' } },
  records: [],
}

describe('attendance-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createAttendanceSession', () => {
    it('creates a session when class exists with teacher', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'class-1',
        teachers: [{ teacherId: 'teacher-1' }],
      })
      mockCreate.mockResolvedValue(mockSession)

      const result = await createAttendanceSession({
        classId: 'class-1',
        date: new Date('2025-01-01'),
      })

      expect(result.session).toEqual(mockSession)
      expect(mockCreate).toHaveBeenCalledOnce()
    })

    it('throws CLASS_NOT_FOUND if class does not exist', async () => {
      mockFindUnique.mockResolvedValue(null)

      await expect(
        createAttendanceSession({
          classId: 'nonexistent',
          date: new Date('2025-01-01'),
        })
      ).rejects.toThrow(ValidationError)

      try {
        await createAttendanceSession({
          classId: 'nonexistent',
          date: new Date('2025-01-01'),
        })
      } catch (error) {
        expect((error as ValidationError).code).toBe(
          ATTENDANCE_ERROR_CODES.CLASS_NOT_FOUND
        )
      }
    })

    it('throws NO_TEACHER_ASSIGNED if class has no active teacher', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'class-1',
        teachers: [],
      })

      await expect(
        createAttendanceSession({
          classId: 'class-1',
          date: new Date('2025-01-01'),
        })
      ).rejects.toThrow(ValidationError)
    })

    it('throws DUPLICATE_SESSION on P2002 error', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'class-1',
        teachers: [{ teacherId: 'teacher-1' }],
      })
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        { code: 'P2002', clientVersion: '5.0.0' }
      )
      mockCreate.mockRejectedValue(p2002Error)

      await expect(
        createAttendanceSession({
          classId: 'class-1',
          date: new Date('2025-01-01'),
        })
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('markAttendanceRecords', () => {
    it('upserts records concurrently for an open session', async () => {
      mockGetSessionById.mockResolvedValue(mockSession)
      mockTransaction.mockImplementation(async (fn: Function) => {
        await fn({
          dugsiAttendanceRecord: {
            upsert: mockUpsert,
          },
        })
      })
      mockUpsert.mockResolvedValue({})

      const result = await markAttendanceRecords({
        sessionId: 'session-1',
        records: [
          {
            programProfileId: 'profile-1',
            status: DugsiAttendanceStatus.PRESENT,
          },
          {
            programProfileId: 'profile-2',
            status: DugsiAttendanceStatus.ABSENT,
          },
        ],
      })

      expect(result.recordCount).toBe(2)
      expect(mockUpsert).toHaveBeenCalledTimes(2)
    })

    it('throws SESSION_NOT_FOUND if session does not exist', async () => {
      mockGetSessionById.mockResolvedValue(null)

      await expect(
        markAttendanceRecords({
          sessionId: 'nonexistent',
          records: [],
        })
      ).rejects.toThrow(ValidationError)
    })

    it('throws SESSION_CLOSED if session is closed', async () => {
      mockGetSessionById.mockResolvedValue({ ...mockSession, isClosed: true })

      await expect(
        markAttendanceRecords({
          sessionId: 'session-1',
          records: [
            {
              programProfileId: 'profile-1',
              status: DugsiAttendanceStatus.PRESENT,
            },
          ],
        })
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('deleteAttendanceSession', () => {
    it('deletes an existing session', async () => {
      mockGetSessionById.mockResolvedValue(mockSession)
      mockDelete.mockResolvedValue(mockSession)

      await deleteAttendanceSession('session-1')

      expect(mockDelete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      })
    })

    it('throws SESSION_NOT_FOUND if session does not exist', async () => {
      mockGetSessionById.mockResolvedValue(null)

      await expect(deleteAttendanceSession('nonexistent')).rejects.toThrow(
        ValidationError
      )
    })
  })
})
