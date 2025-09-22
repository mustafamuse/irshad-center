import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useStudents,
  useAttendanceHistory,
  useMarkAttendance,
  useUpdateAttendanceRecord,
  useDeleteAttendanceSession,
  useSessionSummary,
} from './use-attendance-queries'
import { AttendanceService } from '../_services/attendance.service'
import { mockStudent, mockAttendanceSession } from '../_tests/test-utils'
import type { ReactNode } from 'react'

// Mock the AttendanceService
vi.mock('../_services/attendance.service', () => ({
  AttendanceService: {
    getInstance: vi.fn(() => ({
      fetchStudents: vi.fn(),
      fetchHistory: vi.fn(),
      markAttendance: vi.fn(),
      updateAttendanceRecord: vi.fn(),
      deleteSession: vi.fn(),
      getSessionSummary: vi.fn(),
    })),
  },
}))

describe('Attendance Queries Hooks', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  beforeEach(() => {
    vi.resetAllMocks()
    queryClient.clear()
  })

  describe('useStudents', () => {
    it('fetches and returns students', async () => {
      const mockStudents = [mockStudent(), mockStudent()]
      vi.mocked(AttendanceService.getInstance().fetchStudents).mockResolvedValue(
        mockStudents
      )

      const { result } = renderHook(() => useStudents('batch-1'), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockStudents)
    })

    it('handles errors', async () => {
      vi.mocked(AttendanceService.getInstance().fetchStudents).mockRejectedValue(
        new Error('Failed to fetch')
      )

      const { result } = renderHook(() => useStudents('batch-1'), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('sorts students by name', async () => {
      const mockStudents = [
        mockStudent({ name: 'Zack' }),
        mockStudent({ name: 'Amy' }),
      ]
      vi.mocked(AttendanceService.getInstance().fetchStudents).mockResolvedValue(
        mockStudents
      )

      const { result } = renderHook(() => useStudents('batch-1'), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data![0].name).toBe('Amy')
      expect(result.current.data![1].name).toBe('Zack')
    })
  })

  describe('useAttendanceHistory', () => {
    it('fetches and returns attendance history', async () => {
      const mockSessions = [mockAttendanceSession()]
      vi.mocked(AttendanceService.getInstance().fetchHistory).mockResolvedValue(
        mockSessions
      )

      const { result } = renderHook(() => useAttendanceHistory(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSessions)
    })

    it('applies filters correctly', async () => {
      const filters = {
        batchId: 'batch-1',
        startDate: new Date(),
        endDate: new Date(),
      }

      const { result } = renderHook(() => useAttendanceHistory(filters), {
        wrapper,
      })

      await waitFor(() => {
        expect(
          vi.mocked(AttendanceService.getInstance().fetchHistory)
        ).toHaveBeenCalledWith(filters)
      })
    })
  })

  describe('useMarkAttendance', () => {
    it('marks attendance successfully', async () => {
      const mockData = {
        date: new Date(),
        batchId: 'batch-1',
        attendance: [{ studentId: 'student-1', status: 'present' }],
      }

      const { result } = renderHook(() => useMarkAttendance(), { wrapper })

      result.current.mutate(mockData)

      await waitFor(() => {
        expect(
          vi.mocked(AttendanceService.getInstance().markAttendance)
        ).toHaveBeenCalledWith(
          mockData.date,
          mockData.batchId,
          mockData.attendance
        )
      })
    })

    it('invalidates queries on success', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const { result } = renderHook(() => useMarkAttendance(), { wrapper })

      result.current.mutate({
        date: new Date(),
        batchId: 'batch-1',
        attendance: [],
      })

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled()
      })
    })
  })

  describe('useUpdateAttendanceRecord', () => {
    it('updates attendance record', async () => {
      const mockData = {
        recordId: 'record-1',
        status: 'present',
        notes: 'Test note',
      }

      const { result } = renderHook(() => useUpdateAttendanceRecord(), {
        wrapper,
      })

      result.current.mutate(mockData)

      await waitFor(() => {
        expect(
          vi.mocked(AttendanceService.getInstance().updateAttendanceRecord)
        ).toHaveBeenCalledWith(mockData.recordId, mockData.status, mockData.notes)
      })
    })
  })

  describe('useDeleteAttendanceSession', () => {
    it('deletes attendance session', async () => {
      const sessionId = 'session-1'
      const { result } = renderHook(() => useDeleteAttendanceSession(), {
        wrapper,
      })

      result.current.mutate(sessionId)

      await waitFor(() => {
        expect(
          vi.mocked(AttendanceService.getInstance().deleteSession)
        ).toHaveBeenCalledWith(sessionId)
      })
    })
  })

  describe('useSessionSummary', () => {
    it('fetches session summary', async () => {
      const mockSummary = {
        total: 10,
        present: 8,
        absent: 1,
        late: 1,
        excused: 0,
      }
      vi.mocked(
        AttendanceService.getInstance().getSessionSummary
      ).mockResolvedValue(mockSummary)

      const { result } = renderHook(() => useSessionSummary('session-1'), {
        wrapper,
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSummary)
    })
  })
})