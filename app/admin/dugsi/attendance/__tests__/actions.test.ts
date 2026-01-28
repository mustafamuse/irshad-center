import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockCreateSession,
  mockMarkRecords,
  mockDeleteSession,
  mockGetSessions,
  mockGetStats,
  mockGetClasses,
  mockGetStudents,
} = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
  mockMarkRecords: vi.fn(),
  mockDeleteSession: vi.fn(),
  mockGetSessions: vi.fn(),
  mockGetStats: vi.fn(),
  mockGetClasses: vi.fn(),
  mockGetStudents: vi.fn(),
}))

vi.mock('@/lib/services/dugsi/attendance-service', () => ({
  createAttendanceSession: (...args: unknown[]) => mockCreateSession(...args),
  markAttendanceRecords: (...args: unknown[]) => mockMarkRecords(...args),
  deleteAttendanceSession: (...args: unknown[]) => mockDeleteSession(...args),
}))

vi.mock('@/lib/db/queries/dugsi-attendance', () => ({
  getSessions: (...args: unknown[]) => mockGetSessions(...args),
  getAttendanceStats: (...args: unknown[]) => mockGetStats(...args),
  getActiveClasses: (...args: unknown[]) => mockGetClasses(...args),
  getEnrolledStudentsByClass: (...args: unknown[]) => mockGetStudents(...args),
}))

const { mockRevalidatePath, mockRevalidateTag } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockRevalidateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}))

vi.mock('@/lib/logger', () => ({
  createActionLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logError: vi.fn(),
}))

import { logError } from '@/lib/logger'
import { ValidationError } from '@/lib/services/validation-service'

import {
  createSession,
  markAttendance,
  deleteSession,
  ensureTodaySessions,
  getSessionsAction,
  getAttendanceStatsAction,
  getClassesForDropdownAction,
  getStudentsForClassAction,
} from '../actions'

describe('attendance actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSession', () => {
    it('returns success with valid input', async () => {
      mockCreateSession.mockResolvedValue({
        session: { id: 'session-1' },
      })

      const result = await createSession({
        classId: '00000000-0000-0000-0000-000000000001',
        date: '2025-01-04',
      })

      expect(result.success).toBe(true)
      expect(result.data?.sessionId).toBe('session-1')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/dugsi/attendance')
      expect(mockRevalidateTag).toHaveBeenCalledWith('attendance-stats')
    })

    it('returns generic error for non-validation errors', async () => {
      mockCreateSession.mockRejectedValue(
        new Error('Database connection failed')
      )

      const result = await createSession({
        classId: '00000000-0000-0000-0000-000000000001',
        date: '2025-01-04',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create session')
      expect(logError).toHaveBeenCalled()
    })

    it('returns error for invalid input', async () => {
      const result = await createSession({ classId: 'not-a-uuid' })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('rejects weekday dates via schema validation', async () => {
      const result = await createSession({
        classId: '00000000-0000-0000-0000-000000000001',
        date: '2025-01-06', // Monday
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('weekends')
    })

    it('returns validation error message', async () => {
      mockCreateSession.mockRejectedValue(
        new ValidationError('Duplicate', 'DUPLICATE_SESSION')
      )

      const result = await createSession({
        classId: '00000000-0000-0000-0000-000000000001',
        date: '2025-01-04',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Duplicate')
    })
  })

  describe('markAttendance', () => {
    it('returns success with valid records', async () => {
      mockMarkRecords.mockResolvedValue({ recordCount: 2 })

      const result = await markAttendance({
        sessionId: '00000000-0000-0000-0000-000000000001',
        records: [
          {
            programProfileId: '00000000-0000-0000-0000-000000000002',
            status: 'PRESENT',
          },
        ],
      })

      expect(result.success).toBe(true)
      expect(result.data?.recordCount).toBe(2)
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/dugsi/attendance')
      expect(mockRevalidateTag).toHaveBeenCalledWith('attendance-stats')
    })

    it('returns error for invalid session ID', async () => {
      const result = await markAttendance({
        sessionId: 'bad',
        records: [],
      })
      expect(result.success).toBe(false)
    })

    it('returns generic error for non-validation errors', async () => {
      mockMarkRecords.mockRejectedValue(new Error('Database connection failed'))

      const result = await markAttendance({
        sessionId: '00000000-0000-0000-0000-000000000001',
        records: [
          {
            programProfileId: '00000000-0000-0000-0000-000000000002',
            status: 'PRESENT',
          },
        ],
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to mark attendance')
      expect(logError).toHaveBeenCalled()
    })

    it('calls service with empty records array', async () => {
      mockMarkRecords.mockResolvedValue({ recordCount: 0 })

      const result = await markAttendance({
        sessionId: '00000000-0000-0000-0000-000000000001',
        records: [],
      })

      expect(result.success).toBe(true)
      expect(mockMarkRecords).toHaveBeenCalledWith({
        sessionId: '00000000-0000-0000-0000-000000000001',
        records: [],
      })
    })
  })

  describe('deleteSession', () => {
    it('returns success for valid session', async () => {
      mockDeleteSession.mockResolvedValue(undefined)

      const result = await deleteSession({
        sessionId: '00000000-0000-0000-0000-000000000001',
      })

      expect(result.success).toBe(true)
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/dugsi/attendance')
      expect(mockRevalidateTag).toHaveBeenCalledWith('attendance-stats')
    })

    it('returns validation error', async () => {
      mockDeleteSession.mockRejectedValue(
        new ValidationError('Not found', 'SESSION_NOT_FOUND')
      )

      const result = await deleteSession({
        sessionId: '00000000-0000-0000-0000-000000000001',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not found')
    })
  })

  describe('getSessionsAction', () => {
    it('returns paginated sessions', async () => {
      const mockData = {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      }
      mockGetSessions.mockResolvedValue(mockData)

      const result = await getSessionsAction({})
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockData)
    })
  })

  describe('getAttendanceStatsAction', () => {
    it('returns stats', async () => {
      const stats = {
        totalSessions: 5,
        totalRecords: 50,
        presentCount: 40,
        absentCount: 5,
        lateCount: 3,
        excusedCount: 2,
        attendanceRate: 86,
      }
      mockGetStats.mockResolvedValue(stats)

      const result = await getAttendanceStatsAction()
      expect(result.success).toBe(true)
      expect(result.data).toEqual(stats)
    })
  })

  describe('getClassesForDropdownAction', () => {
    it('returns class options', async () => {
      mockGetClasses.mockResolvedValue([
        { id: 'c1', name: 'Class A', shift: 'MORNING' },
      ])

      const result = await getClassesForDropdownAction()
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getStudentsForClassAction', () => {
    it('returns student options', async () => {
      mockGetStudents.mockResolvedValue([
        { programProfileId: 'p1', name: 'Student A' },
      ])

      const result = await getStudentsForClassAction(
        '00000000-0000-0000-0000-000000000001'
      )
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })
  })

  describe('ensureTodaySessions', () => {
    it('returns success without creating sessions on weekdays', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-06T12:00:00Z'))

      const result = await ensureTodaySessions()

      expect(result.success).toBe(true)
      expect(mockGetClasses).not.toHaveBeenCalled()
      expect(mockCreateSession).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('creates sessions for all active classes on Saturday', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-04T12:00:00Z'))

      mockGetClasses.mockResolvedValue([
        { id: 'c1', name: 'Class A', shift: 'MORNING' },
        { id: 'c2', name: 'Class B', shift: 'AFTERNOON' },
      ])
      mockCreateSession.mockResolvedValue({ session: { id: 's1' } })

      const result = await ensureTodaySessions()

      expect(result.success).toBe(true)
      expect(mockGetClasses).toHaveBeenCalled()
      expect(mockCreateSession).toHaveBeenCalledTimes(2)
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/dugsi/attendance')
      expect(mockRevalidateTag).toHaveBeenCalledWith('attendance-stats')

      vi.useRealTimers()
    })

    it('creates sessions for all active classes on Sunday', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-05T12:00:00Z'))

      mockGetClasses.mockResolvedValue([
        { id: 'c1', name: 'Class A', shift: 'MORNING' },
      ])
      mockCreateSession.mockResolvedValue({ session: { id: 's1' } })

      const result = await ensureTodaySessions()

      expect(result.success).toBe(true)
      expect(mockCreateSession).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })

    it('succeeds even when some session creations fail', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-04T12:00:00Z'))

      mockGetClasses.mockResolvedValue([
        { id: 'c1', name: 'Class A', shift: 'MORNING' },
        { id: 'c2', name: 'Class B', shift: 'AFTERNOON' },
      ])
      mockCreateSession
        .mockResolvedValueOnce({ session: { id: 's1' } })
        .mockRejectedValueOnce(new Error('Duplicate session'))

      const result = await ensureTodaySessions()

      expect(result.success).toBe(true)
      expect(mockCreateSession).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })
  })
})
