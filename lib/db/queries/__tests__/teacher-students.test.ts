import { DugsiAttendanceStatus } from '@prisma/client'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockClassTeacherFindMany,
  mockEnrollmentFindMany,
  mockEnrollmentFindUnique,
  mockRecordGroupBy,
  mockRecordFindMany,
  mockRecordCount,
} = vi.hoisted(() => ({
  mockClassTeacherFindMany: vi.fn(),
  mockEnrollmentFindMany: vi.fn(),
  mockEnrollmentFindUnique: vi.fn(),
  mockRecordGroupBy: vi.fn(),
  mockRecordFindMany: vi.fn(),
  mockRecordCount: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    dugsiClassTeacher: {
      findMany: (...args: unknown[]) => mockClassTeacherFindMany(...args),
    },
    dugsiClassEnrollment: {
      findMany: (...args: unknown[]) => mockEnrollmentFindMany(...args),
      findUnique: (...args: unknown[]) => mockEnrollmentFindUnique(...args),
    },
    dugsiAttendanceRecord: {
      groupBy: (...args: unknown[]) => mockRecordGroupBy(...args),
      findMany: (...args: unknown[]) => mockRecordFindMany(...args),
      count: (...args: unknown[]) => mockRecordCount(...args),
    },
  },
}))

import {
  getTeacherClassIds,
  getStudentsByTeacher,
  getStudentProfile,
  getStudentAttendanceStats,
  getStudentMonthlyComparison,
  getStudentWeeklyTrend,
  getStudentAttendanceRecords,
} from '../teacher-students'

describe('teacher-students queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTeacherClassIds', () => {
    it('returns class IDs for teacher', async () => {
      mockClassTeacherFindMany.mockResolvedValue([
        { classId: 'c1' },
        { classId: 'c2' },
      ])
      const result = await getTeacherClassIds('teacher-1')
      expect(result).toEqual(['c1', 'c2'])
      expect(mockClassTeacherFindMany).toHaveBeenCalledWith({
        where: { teacherId: 'teacher-1', isActive: true },
        select: { classId: true },
      })
    })
  })

  describe('getStudentsByTeacher', () => {
    it('returns empty array when no classes', async () => {
      mockClassTeacherFindMany.mockResolvedValue([])
      const result = await getStudentsByTeacher('teacher-1')
      expect(result).toEqual([])
    })

    it('returns students with computed age', async () => {
      mockClassTeacherFindMany.mockResolvedValue([{ classId: 'c1' }])
      mockEnrollmentFindMany.mockResolvedValue([
        {
          programProfileId: 'pp1',
          programProfile: {
            person: { name: 'Ali', dateOfBirth: new Date('2015-01-01') },
            familyReferenceId: 'fam1',
          },
          class: { name: 'Class A', shift: 'MORNING' },
        },
      ])
      const result = await getStudentsByTeacher('teacher-1')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Ali')
      expect(result[0].age).toBeGreaterThan(0)
    })
  })

  describe('getStudentProfile', () => {
    it('returns null when not found', async () => {
      mockEnrollmentFindUnique.mockResolvedValue(null)
      const result = await getStudentProfile('missing')
      expect(result).toBeNull()
    })

    it('returns profile data', async () => {
      mockEnrollmentFindUnique.mockResolvedValue({
        programProfileId: 'pp1',
        programProfile: { person: { name: 'Ali' } },
        class: { id: 'c1', name: 'Class A', shift: 'MORNING' },
      })
      const result = await getStudentProfile('pp1')
      expect(result).toEqual({
        profileId: 'pp1',
        name: 'Ali',
        className: 'Class A',
        shift: 'MORNING',
        classId: 'c1',
      })
    })
  })

  describe('getStudentAttendanceStats', () => {
    it('returns stats with computed rate', async () => {
      mockRecordGroupBy.mockResolvedValue([
        { status: DugsiAttendanceStatus.PRESENT, _count: { status: 8 } },
        { status: DugsiAttendanceStatus.ABSENT, _count: { status: 2 } },
      ])
      mockRecordFindMany.mockResolvedValue([])

      const result = await getStudentAttendanceStats('pp1')
      expect(result.totalSessions).toBe(10)
      expect(result.attendanceRate).toBe(80)
      expect(result.presentCount).toBe(8)
      expect(result.absentCount).toBe(2)
    })
  })

  describe('getStudentMonthlyComparison', () => {
    it('returns null when no previous records', async () => {
      mockRecordGroupBy
        .mockResolvedValueOnce([
          { status: DugsiAttendanceStatus.PRESENT, _count: { status: 5 } },
        ])
        .mockResolvedValueOnce([])
      const result = await getStudentMonthlyComparison('pp1')
      expect(result).toBeNull()
    })

    it('returns diff when both months have data', async () => {
      mockRecordGroupBy
        .mockResolvedValueOnce([
          { status: DugsiAttendanceStatus.PRESENT, _count: { status: 8 } },
          { status: DugsiAttendanceStatus.ABSENT, _count: { status: 2 } },
        ])
        .mockResolvedValueOnce([
          { status: DugsiAttendanceStatus.PRESENT, _count: { status: 6 } },
          { status: DugsiAttendanceStatus.ABSENT, _count: { status: 4 } },
        ])
      const result = await getStudentMonthlyComparison('pp1')
      expect(result).not.toBeNull()
      expect(result!.diff).toBe(20)
    })
  })

  describe('getStudentWeeklyTrend', () => {
    it('returns mapped records', async () => {
      const date = new Date('2024-01-06')
      mockRecordFindMany.mockResolvedValue([
        { status: 'PRESENT', session: { date } },
      ])
      const result = await getStudentWeeklyTrend('pp1')
      expect(result).toEqual([{ date, status: 'PRESENT' }])
    })
  })

  describe('getStudentAttendanceRecords', () => {
    it('returns paginated results with hasMore', async () => {
      const records = Array.from({ length: 21 }, (_, i) => ({
        sessionId: `s${i}`,
        session: { id: `s${i}`, date: new Date('2024-01-06') },
        status: 'PRESENT',
        lessonCompleted: false,
        surahName: null,
        ayatFrom: null,
        ayatTo: null,
        programProfileId: 'pp1',
      }))
      mockRecordFindMany.mockResolvedValue(records)
      mockRecordCount.mockResolvedValue(25)

      const result = await getStudentAttendanceRecords('pp1')
      expect(result.data).toHaveLength(20)
      expect(result.hasMore).toBe(true)
      expect(result.total).toBe(25)
    })

    it('returns hasMore=false when no more', async () => {
      mockRecordFindMany.mockResolvedValue([
        {
          sessionId: 's1',
          session: { id: 's1', date: new Date('2024-01-06') },
          status: 'PRESENT',
          lessonCompleted: true,
          surahName: 'Al-Fatiha',
          ayatFrom: 1,
          ayatTo: 7,
          programProfileId: 'pp1',
        },
      ])
      mockRecordCount.mockResolvedValue(1)

      const result = await getStudentAttendanceRecords('pp1')
      expect(result.data).toHaveLength(1)
      expect(result.hasMore).toBe(false)
    })
  })
})
