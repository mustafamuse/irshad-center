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

const TEST_IDS = {
  session: '00000000-0000-0000-0000-000000000001',
  class: '00000000-0000-0000-0000-000000000002',
  teacher: '00000000-0000-0000-0000-000000000003',
  person: '00000000-0000-0000-0000-000000000004',
  profile1: '00000000-0000-0000-0000-000000000005',
  profile2: '00000000-0000-0000-0000-000000000006',
  nonexistent: '00000000-0000-0000-0000-000000000099',
}

const mockSession = {
  id: TEST_IDS.session,
  classId: TEST_IDS.class,
  teacherId: TEST_IDS.teacher,
  date: new Date('2025-01-04'),
  notes: null,
  isClosed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  class: { id: TEST_IDS.class, name: 'Class A', shift: 'MORNING' },
  teacher: {
    id: TEST_IDS.teacher,
    person: { id: TEST_IDS.person, name: 'Teacher One' },
  },
  records: [],
}

describe('attendance-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createAttendanceSession', () => {
    it('creates a session when class exists with teacher', async () => {
      mockFindUnique.mockResolvedValue({
        id: TEST_IDS.class,
        teachers: [{ teacherId: TEST_IDS.teacher }],
      })
      mockCreate.mockResolvedValue(mockSession)

      const result = await createAttendanceSession({
        classId: TEST_IDS.class,
        date: new Date('2025-01-04'),
      })

      expect(result.session).toEqual(mockSession)
      expect(mockCreate).toHaveBeenCalledOnce()
    })

    it('throws CLASS_NOT_FOUND if class does not exist', async () => {
      mockFindUnique.mockResolvedValue(null)

      await expect(
        createAttendanceSession({
          classId: TEST_IDS.nonexistent,
          date: new Date('2025-01-04'),
        })
      ).rejects.toThrow(ValidationError)

      try {
        await createAttendanceSession({
          classId: TEST_IDS.nonexistent,
          date: new Date('2025-01-04'),
        })
      } catch (error) {
        expect((error as ValidationError).code).toBe(
          ATTENDANCE_ERROR_CODES.CLASS_NOT_FOUND
        )
      }
    })

    it('throws NO_TEACHER_ASSIGNED if class has no active teacher', async () => {
      mockFindUnique.mockResolvedValue({
        id: TEST_IDS.class,
        teachers: [],
      })

      await expect(
        createAttendanceSession({
          classId: TEST_IDS.class,
          date: new Date('2025-01-04'),
        })
      ).rejects.toThrow(ValidationError)
    })

    it('throws for weekday dates', async () => {
      await expect(
        createAttendanceSession({
          classId: TEST_IDS.class,
          date: new Date('2025-01-06'), // Monday
        })
      ).rejects.toThrow()
    })

    it('throws DUPLICATE_SESSION on P2002 error', async () => {
      mockFindUnique.mockResolvedValue({
        id: TEST_IDS.class,
        teachers: [{ teacherId: TEST_IDS.teacher }],
      })
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        { code: 'P2002', clientVersion: '5.0.0' }
      )
      mockCreate.mockRejectedValue(p2002Error)

      await expect(
        createAttendanceSession({
          classId: TEST_IDS.class,
          date: new Date('2025-01-04'),
        })
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('markAttendanceRecords', () => {
    it('upserts records concurrently for an open session', async () => {
      const nextSaturday = new Date()
      nextSaturday.setDate(
        nextSaturday.getDate() + ((6 - nextSaturday.getDay() + 7) % 7 || 7)
      )
      mockGetSessionById.mockResolvedValue({
        ...mockSession,
        date: nextSaturday,
      })
      mockTransaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          await fn({
            dugsiAttendanceRecord: {
              upsert: mockUpsert,
            },
          })
        }
      )
      mockUpsert.mockResolvedValue({})

      const result = await markAttendanceRecords({
        sessionId: TEST_IDS.session,
        records: [
          {
            programProfileId: TEST_IDS.profile1,
            status: DugsiAttendanceStatus.PRESENT,
          },
          {
            programProfileId: TEST_IDS.profile2,
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
          sessionId: TEST_IDS.nonexistent,
          records: [],
        })
      ).rejects.toThrow(ValidationError)
    })

    it('throws SESSION_CLOSED if session is closed', async () => {
      mockGetSessionById.mockResolvedValue({ ...mockSession, isClosed: true })

      await expect(
        markAttendanceRecords({
          sessionId: TEST_IDS.session,
          records: [
            {
              programProfileId: TEST_IDS.profile1,
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

      await deleteAttendanceSession(TEST_IDS.session)

      expect(mockDelete).toHaveBeenCalledWith({
        where: { id: TEST_IDS.session },
      })
    })

    it('throws SESSION_NOT_FOUND if session does not exist', async () => {
      mockGetSessionById.mockResolvedValue(null)

      await expect(
        deleteAttendanceSession(TEST_IDS.nonexistent)
      ).rejects.toThrow(ValidationError)
    })
  })
})
