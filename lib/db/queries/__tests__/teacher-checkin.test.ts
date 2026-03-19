import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockCheckinFindMany,
  mockCheckinFindUnique,
  mockCheckinCount,
  mockTeacherFindMany,
} = vi.hoisted(() => ({
  mockCheckinFindMany: vi.fn(),
  mockCheckinFindUnique: vi.fn(),
  mockCheckinCount: vi.fn(),
  mockTeacherFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    dugsiTeacherCheckIn: {
      findMany: mockCheckinFindMany,
      findUnique: mockCheckinFindUnique,
      count: mockCheckinCount,
    },
    teacher: {
      findMany: mockTeacherFindMany,
    },
  },
}))

import {
  getCheckinById,
  getTeacherCheckin,
  getCheckinsForDate,
  getCheckinHistory,
  getLateArrivals,
  getAllDugsiTeachersWithTodayStatus,
  getDugsiTeachersForDropdown,
} from '../teacher-checkin'

describe('teacher-checkin queries use relationLoadStrategy: join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCheckinById', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockCheckinFindUnique.mockResolvedValue(null)

      await getCheckinById('checkin-1')

      expect(mockCheckinFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getTeacherCheckin', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockCheckinFindUnique.mockResolvedValue(null)

      await getTeacherCheckin('teacher-1', new Date('2025-06-01'), 'MORNING')

      expect(mockCheckinFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getCheckinsForDate', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockCheckinFindMany.mockResolvedValue([])

      await getCheckinsForDate({ date: new Date('2025-06-01') })

      expect(mockCheckinFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getCheckinHistory', () => {
    it('should pass relationLoadStrategy join to findMany', async () => {
      mockCheckinFindMany.mockResolvedValue([])
      mockCheckinCount.mockResolvedValue(0)

      await getCheckinHistory()

      expect(mockCheckinFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getLateArrivals', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockCheckinFindMany.mockResolvedValue([])

      await getLateArrivals({
        dateFrom: new Date('2025-06-01'),
        dateTo: new Date('2025-06-30'),
      })

      expect(mockCheckinFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getAllDugsiTeachersWithTodayStatus', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockTeacherFindMany.mockResolvedValue([])

      await getAllDugsiTeachersWithTodayStatus(new Date('2025-06-01'))

      expect(mockTeacherFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })

  describe('getDugsiTeachersForDropdown', () => {
    it('should pass relationLoadStrategy join', async () => {
      mockTeacherFindMany.mockResolvedValue([])

      await getDugsiTeachersForDropdown()

      expect(mockTeacherFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          relationLoadStrategy: 'join',
        })
      )
    })
  })
})
