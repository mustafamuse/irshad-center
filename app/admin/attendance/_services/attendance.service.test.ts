import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AttendanceService } from './attendance.service'
import { ApiClient, ApiError, ValidationError } from './api-client'
import { mockStudent, mockAttendanceSession } from '../_tests/test-utils'

vi.mock('./api-client', () => ({
  ApiClient: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      retryWithBackoff: vi.fn(),
    })),
  },
  ApiError: class extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ApiError'
    }
  },
  ValidationError: class extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ValidationError'
    }
  },
}))

describe('AttendanceService', () => {
  let service: AttendanceService
  let mockApiClient: ReturnType<typeof ApiClient.getInstance>

  beforeEach(() => {
    vi.resetAllMocks()
    service = AttendanceService.getInstance()
    mockApiClient = ApiClient.getInstance()
  })

  describe('fetchStudents', () => {
    it('fetches students with retry logic', async () => {
      const mockStudents = [mockStudent(), mockStudent()]
      vi.mocked(mockApiClient.retryWithBackoff).mockResolvedValueOnce(
        mockStudents
      )

      const result = await service.fetchStudents('batch-1')

      expect(mockApiClient.retryWithBackoff).toHaveBeenCalled()
      expect(result).toEqual(mockStudents)
    })

    it('handles API errors', async () => {
      vi.mocked(mockApiClient.retryWithBackoff).mockRejectedValueOnce(
        new ApiError('Failed to fetch')
      )

      await expect(service.fetchStudents('batch-1')).rejects.toThrow(ApiError)
    })
  })

  describe('markAttendance', () => {
    const mockDate = new Date('2025-01-01')
    const mockAttendanceData = [
      { studentId: 'student-1', status: 'present' },
      { studentId: 'student-2', status: 'absent' },
    ]

    it('validates and submits attendance records', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce(undefined)

      await service.markAttendance(mockDate, 'batch-1', mockAttendanceData)

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/admin/attendance/mark',
        {
          date: mockDate.toISOString(),
          batchId: 'batch-1',
          attendance: mockAttendanceData,
        }
      )
    })

    it('handles validation errors', async () => {
      vi.mocked(mockApiClient.post).mockRejectedValueOnce(
        new ValidationError('Invalid data')
      )

      await expect(
        service.markAttendance(mockDate, 'batch-1', mockAttendanceData)
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('fetchHistory', () => {
    const mockFilters = {
      batchId: 'batch-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
    }

    it('fetches and transforms attendance history', async () => {
      const mockSessions = [mockAttendanceSession()]
      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockSessions)

      const result = await service.fetchHistory(mockFilters)

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/attendance/history'),
        expect.any(Object),
        expect.any(Object)
      )
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            date: expect.any(Date),
          }),
        ])
      )
    })

    it('handles empty filters', async () => {
      await service.fetchHistory()

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/admin/attendance/history?',
        expect.any(Object),
        expect.any(Object)
      )
    })
  })

  describe('getSessionSummary', () => {
    it('fetches session summary with retry logic', async () => {
      const mockSummary = {
        total: 10,
        present: 8,
        absent: 1,
        late: 1,
        excused: 0,
      }
      vi.mocked(mockApiClient.retryWithBackoff).mockResolvedValueOnce(
        mockSummary
      )

      const result = await service.getSessionSummary('session-1')

      expect(mockApiClient.retryWithBackoff).toHaveBeenCalled()
      expect(result).toEqual(mockSummary)
    })
  })

  describe('updateAttendanceRecord', () => {
    it('updates attendance record', async () => {
      vi.mocked(mockApiClient.patch).mockResolvedValueOnce(undefined)

      await service.updateAttendanceRecord('record-1', 'present', 'Note')

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        '/api/admin/attendance/records/record-1',
        { status: 'present', notes: 'Note' }
      )
    })
  })

  describe('deleteSession', () => {
    it('deletes attendance session', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce(undefined)

      await service.deleteSession('session-1')

      expect(mockApiClient.delete).toHaveBeenCalledWith(
        '/api/admin/attendance/sessions/session-1'
      )
    })

    it('handles deletion errors', async () => {
      vi.mocked(mockApiClient.delete).mockRejectedValueOnce(
        new ApiError('Failed to delete')
      )

      await expect(service.deleteSession('session-1')).rejects.toThrow(ApiError)
    })
  })
})
