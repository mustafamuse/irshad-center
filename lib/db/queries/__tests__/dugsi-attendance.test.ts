import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockFindUnique,
  mockFindMany,
  mockCount,
  mockGroupBy,
  mockEnrollmentFindMany,
  mockClassFindMany,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockGroupBy: vi.fn(),
  mockEnrollmentFindMany: vi.fn(),
  mockClassFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    dugsiAttendanceSession: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    dugsiAttendanceRecord: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
    dugsiClassEnrollment: {
      findMany: (...args: unknown[]) => mockEnrollmentFindMany(...args),
    },
    dugsiClass: {
      findMany: (...args: unknown[]) => mockClassFindMany(...args),
    },
  },
}))

import {
  getSessionById,
  getSessions,
  getSessionByClassAndDate,
  getEnrolledStudentsByClass,
  getEnrolledStudentsByClasses,
  getActiveClasses,
  getAttendanceStats,
  getSessionsForList,
} from '../dugsi-attendance'

describe('dugsi-attendance queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSessionById', () => {
    it('returns session with include', async () => {
      const session = { id: 'session-1', classId: 'class-1' }
      mockFindUnique.mockResolvedValue(session)

      const result = await getSessionById('session-1')
      expect(result).toEqual(session)
      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'session-1' } })
      )
    })

    it('returns null when not found', async () => {
      mockFindUnique.mockResolvedValue(null)
      const result = await getSessionById('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getSessions', () => {
    it('returns paginated sessions', async () => {
      mockFindMany.mockResolvedValue([{ id: 'session-1' }])
      mockCount.mockResolvedValue(1)

      const result = await getSessions({}, { page: 1, limit: 10 })
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.totalPages).toBe(1)
    })

    it('filters by classId', async () => {
      mockFindMany.mockResolvedValue([])
      mockCount.mockResolvedValue(0)

      await getSessions({ classId: 'class-1' })
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ classId: 'class-1' }),
        })
      )
    })

    it('filters by date range', async () => {
      mockFindMany.mockResolvedValue([])
      mockCount.mockResolvedValue(0)

      await getSessions({
        dateFrom: new Date('2025-01-01'),
        dateTo: new Date('2025-01-31'),
      })
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      )
    })
  })

  describe('getSessionByClassAndDate', () => {
    it('queries by unique constraint', async () => {
      mockFindUnique.mockResolvedValue({ id: 'session-1' })

      await getSessionByClassAndDate('class-1', new Date('2025-01-01'))
      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            date_classId: expect.objectContaining({
              classId: 'class-1',
            }),
          },
        })
      )
    })
  })

  describe('getEnrolledStudentsByClass', () => {
    it('returns mapped student list', async () => {
      mockEnrollmentFindMany.mockResolvedValue([
        {
          programProfileId: 'profile-1',
          programProfile: { person: { name: 'Student A' } },
        },
      ])

      const result = await getEnrolledStudentsByClass('class-1')
      expect(result).toEqual([
        { programProfileId: 'profile-1', name: 'Student A' },
      ])
    })
  })

  describe('getActiveClasses', () => {
    it('returns active classes', async () => {
      mockClassFindMany.mockResolvedValue([
        { id: 'class-1', name: 'Class A', shift: 'MORNING' },
      ])

      const result = await getActiveClasses()
      expect(result).toHaveLength(1)
      expect(mockClassFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      )
    })
  })

  describe('getAttendanceStats', () => {
    it('returns aggregated stats', async () => {
      mockCount.mockResolvedValue(5)
      mockGroupBy.mockResolvedValue([
        { status: 'PRESENT', _count: { status: 10 } },
        { status: 'ABSENT', _count: { status: 3 } },
        { status: 'LATE', _count: { status: 2 } },
      ])

      const result = await getAttendanceStats()
      expect(result.totalSessions).toBe(5)
      expect(result.presentCount).toBe(10)
      expect(result.absentCount).toBe(3)
      expect(result.lateCount).toBe(2)
      expect(result.attendanceRate).toBe(80)
    })
  })

  describe('getSessionsForList', () => {
    it('returns paginated sessions with list include', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'session-1', records: [{ status: 'PRESENT' }] },
      ])
      mockCount.mockResolvedValue(1)

      const result = await getSessionsForList({}, { page: 1, limit: 10 })
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.totalPages).toBe(1)
    })
  })

  describe('getEnrolledStudentsByClasses', () => {
    it('returns map grouped by classId', async () => {
      mockEnrollmentFindMany.mockResolvedValue([
        {
          classId: 'class-1',
          programProfileId: 'profile-1',
          programProfile: { person: { name: 'Student A' } },
        },
        {
          classId: 'class-2',
          programProfileId: 'profile-2',
          programProfile: { person: { name: 'Student B' } },
        },
      ])

      const result = await getEnrolledStudentsByClasses(['class-1', 'class-2'])
      expect(result.get('class-1')).toEqual([
        { programProfileId: 'profile-1', name: 'Student A' },
      ])
      expect(result.get('class-2')).toEqual([
        { programProfileId: 'profile-2', name: 'Student B' },
      ])
    })

    it('returns empty map for empty classIds', async () => {
      const result = await getEnrolledStudentsByClasses([])
      expect(result.size).toBe(0)
      expect(mockEnrollmentFindMany).not.toHaveBeenCalled()
    })
  })
})
