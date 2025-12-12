import { DugsiAttendanceStatus } from '@prisma/client'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  mockFindManySessions,
  mockFindUniqueSession,
  mockCreateSession,
  mockUpdateSession,
  mockFindManyRecords,
  mockGroupByRecords,
  mockUpsertRecord,
  mockFindUniqueClass,
} = vi.hoisted(() => ({
  mockFindManySessions: vi.fn(),
  mockFindUniqueSession: vi.fn(),
  mockCreateSession: vi.fn(),
  mockUpdateSession: vi.fn(),
  mockFindManyRecords: vi.fn(),
  mockGroupByRecords: vi.fn(),
  mockUpsertRecord: vi.fn(),
  mockFindUniqueClass: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    dugsiAttendanceSession: {
      findMany: (...args: unknown[]) => mockFindManySessions(...args),
      findUnique: (...args: unknown[]) => mockFindUniqueSession(...args),
      create: (...args: unknown[]) => mockCreateSession(...args),
      update: (...args: unknown[]) => mockUpdateSession(...args),
    },
    dugsiAttendanceRecord: {
      findMany: (...args: unknown[]) => mockFindManyRecords(...args),
      groupBy: (...args: unknown[]) => mockGroupByRecords(...args),
      upsert: (...args: unknown[]) => mockUpsertRecord(...args),
    },
    dugsiClass: {
      findUnique: (...args: unknown[]) => mockFindUniqueClass(...args),
    },
  },
}))

import {
  getSessionsByClass,
  getTodaysSessionForClass,
  getAttendanceRecordsBySession,
  getStudentAttendanceHistory,
  getClassAttendanceStats,
} from '../dugsi-attendance'

describe('Dugsi Attendance Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSessionsByClass', () => {
    it('should return sessions for a class within date range', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          date: new Date('2024-12-07'),
          classId: 'class-1',
          teacherId: 'teacher-1',
          isClosed: false,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          class: { name: 'Quran Basics' },
          teacher: { person: { name: 'Ahmed Ali' } },
          _count: { records: 10 },
        },
      ]
      mockFindManySessions.mockResolvedValue(mockSessions)

      const result = await getSessionsByClass('class-1', {
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31'),
      })

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('session-1')
      expect(mockFindManySessions).toHaveBeenCalledWith({
        where: {
          classId: 'class-1',
          date: { gte: expect.any(Date), lte: expect.any(Date) },
        },
        include: {
          class: { select: { name: true } },
          teacher: { include: { person: { select: { name: true } } } },
          _count: { select: { records: true } },
        },
        orderBy: { date: 'desc' },
      })
    })

    it('should return sessions without date filter', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          date: new Date('2024-12-07'),
          classId: 'class-1',
          teacherId: 'teacher-1',
          isClosed: false,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          class: { name: 'Quran Basics' },
          teacher: { person: { name: 'Ahmed Ali' } },
          _count: { records: 10 },
        },
      ]
      mockFindManySessions.mockResolvedValue(mockSessions)

      const result = await getSessionsByClass('class-1')

      expect(result).toHaveLength(1)
      expect(mockFindManySessions).toHaveBeenCalledWith({
        where: {
          classId: 'class-1',
        },
        include: {
          class: { select: { name: true } },
          teacher: { include: { person: { select: { name: true } } } },
          _count: { select: { records: true } },
        },
        orderBy: { date: 'desc' },
      })
    })
  })

  describe('getTodaysSessionForClass', () => {
    it('should return session for today if exists', async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const mockSession = {
        id: 'session-1',
        date: today,
        classId: 'class-1',
        teacherId: 'teacher-1',
        isClosed: false,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        records: [
          {
            id: 'record-1',
            status: DugsiAttendanceStatus.PRESENT,
            profile: {
              person: { name: 'Ahmed Omar' },
            },
          },
        ],
      }
      mockFindUniqueSession.mockResolvedValue(mockSession)

      const result = await getTodaysSessionForClass('class-1')

      expect(result?.id).toBe('session-1')
      expect(result?.date).toEqual(today)
      expect(mockFindUniqueSession).toHaveBeenCalledWith({
        where: {
          date_classId: { date: today, classId: 'class-1' },
        },
        include: {
          records: {
            include: {
              profile: {
                include: { person: { select: { name: true } } },
              },
            },
          },
        },
      })
    })

    it('should return null if no session today', async () => {
      mockFindUniqueSession.mockResolvedValue(null)

      const result = await getTodaysSessionForClass('class-1')

      expect(result).toBeNull()
    })
  })

  describe('getAttendanceRecordsBySession', () => {
    it('should return all records for a session with student info', async () => {
      const mockRecords = [
        {
          id: 'record-1',
          sessionId: 'session-1',
          programProfileId: 'profile-1',
          status: DugsiAttendanceStatus.PRESENT,
          lessonCompleted: true,
          surahName: 'Al-Fatiha',
          ayatFrom: 1,
          ayatTo: 7,
          lessonNotes: null,
          notes: null,
          markedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          profile: {
            person: { name: 'Ahmed Omar' },
          },
        },
      ]
      mockFindManyRecords.mockResolvedValue(mockRecords)

      const result = await getAttendanceRecordsBySession('session-1')

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe(DugsiAttendanceStatus.PRESENT)
      expect(result[0].profile.person.name).toBe('Ahmed Omar')
      expect(mockFindManyRecords).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        include: {
          profile: {
            include: { person: { select: { name: true } } },
          },
        },
        orderBy: { profile: { person: { name: 'asc' } } },
      })
    })

    it('should return empty array if no records', async () => {
      mockFindManyRecords.mockResolvedValue([])

      const result = await getAttendanceRecordsBySession('session-1')

      expect(result).toEqual([])
    })
  })

  describe('getStudentAttendanceHistory', () => {
    it('should return attendance history for a student', async () => {
      const mockRecords = [
        {
          id: 'record-1',
          status: DugsiAttendanceStatus.PRESENT,
          session: {
            date: new Date('2024-12-07'),
            class: { name: 'Quran Basics' },
          },
        },
        {
          id: 'record-2',
          status: DugsiAttendanceStatus.PRESENT,
          session: {
            date: new Date('2024-12-08'),
            class: { name: 'Quran Basics' },
          },
        },
        {
          id: 'record-3',
          status: DugsiAttendanceStatus.ABSENT,
          session: {
            date: new Date('2024-12-09'),
            class: { name: 'Quran Basics' },
          },
        },
      ]
      mockFindManyRecords.mockResolvedValue(mockRecords)

      const result = await getStudentAttendanceHistory('profile-1')

      expect(result).toHaveLength(3)
      expect(result[0].status).toBe(DugsiAttendanceStatus.PRESENT)
    })

    it('should filter by date range', async () => {
      mockFindManyRecords.mockResolvedValue([])

      await getStudentAttendanceHistory('profile-1', {
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31'),
      })

      expect(mockFindManyRecords).toHaveBeenCalledWith({
        where: {
          programProfileId: 'profile-1',
          session: {
            date: { gte: expect.any(Date), lte: expect.any(Date) },
          },
        },
        include: {
          session: {
            include: { class: { select: { name: true } } },
          },
        },
        orderBy: { session: { date: 'desc' } },
      })
    })
  })

  describe('getClassAttendanceStats', () => {
    it('should return aggregated attendance stats for a class', async () => {
      mockFindUniqueClass.mockResolvedValue({ name: 'Quran Basics' })
      mockFindManySessions.mockResolvedValue([
        { id: 'session-1' },
        { id: 'session-2' },
      ])
      const mockRecords = [
        { status: DugsiAttendanceStatus.PRESENT, lessonCompleted: true },
        { status: DugsiAttendanceStatus.PRESENT, lessonCompleted: false },
        { status: DugsiAttendanceStatus.LATE, lessonCompleted: true },
        { status: DugsiAttendanceStatus.ABSENT, lessonCompleted: false },
      ]
      mockFindManyRecords.mockResolvedValue(mockRecords)

      const result = await getClassAttendanceStats('class-1', {
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31'),
      })

      expect(result.classId).toBe('class-1')
      expect(result.className).toBe('Quran Basics')
      expect(result.totalSessions).toBe(2)
      expect(result.averageAttendanceRate).toBe(75)
      expect(result.averageLessonCompletionRate).toBe(67)
    })

    it('should return zero rates when no sessions exist', async () => {
      mockFindUniqueClass.mockResolvedValue({ name: 'Empty Class' })
      mockFindManySessions.mockResolvedValue([])

      const result = await getClassAttendanceStats('class-1', {})

      expect(result.totalSessions).toBe(0)
      expect(result.averageAttendanceRate).toBe(0)
      expect(result.averageLessonCompletionRate).toBe(0)
    })
  })
})
