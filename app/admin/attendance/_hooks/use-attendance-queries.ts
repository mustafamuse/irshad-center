import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ApiError, ValidationError } from '../_services/api-client'
import { AttendanceService } from '../_services/attendance.service'
import type { AttendanceFilters, AttendanceSession, Student } from '../_types'

// Query keys for cache management
export const attendanceKeys = {
  all: ['attendance'] as const,
  students: (batchId: string) =>
    [...attendanceKeys.all, 'students', batchId] as const,
  history: (filters?: AttendanceFilters) =>
    [...attendanceKeys.all, 'history', filters] as const,
  session: (sessionId: string) =>
    [...attendanceKeys.all, 'session', sessionId] as const,
}

const attendanceService = AttendanceService.getInstance()

/**
 * Hook for fetching students in a batch
 */
export function useStudents(batchId: string | undefined) {
  return useQuery({
    queryKey: batchId ? attendanceKeys.students(batchId) : null,
    queryFn: () => attendanceService.fetchStudents(batchId!),
    enabled: !!batchId,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on validation errors
      if (error instanceof ValidationError) return false
      // Retry up to 3 times for other errors
      return failureCount < 3
    },
    select: (data: Student[]) =>
      // Sort students by name
      [...data].sort((a, b) => a.name.localeCompare(b.name)),
  })
}

/**
 * Hook for fetching attendance history
 */
export function useAttendanceHistory(filters?: AttendanceFilters) {
  return useQuery({
    queryKey: attendanceKeys.history(filters),
    queryFn: () => attendanceService.fetchHistory(filters),
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    select: (data: AttendanceSession[]) =>
      // Sort sessions by date (most recent first)
      [...data].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
  })
}

/**
 * Hook for marking attendance
 */
export function useMarkAttendance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      date,
      batchId,
      attendance,
    }: {
      date: Date
      batchId: string
      attendance: { studentId: string; status: string }[]
    }) => {
      await attendanceService.markAttendance(date, batchId, attendance)
    },
    onSuccess: (_, { batchId, date }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries(attendanceKeys.history())

      toast.success('Attendance marked successfully')
    },
    onError: (error) => {
      console.error('Error marking attendance:', error)
      if (error instanceof ValidationError) {
        toast.error('Invalid attendance data. Please check your inputs.')
      } else if (error instanceof ApiError) {
        toast.error(error.message || 'Failed to mark attendance')
      } else {
        toast.error('An unexpected error occurred')
      }
    },
  })
}

/**
 * Hook for updating an attendance record
 */
export function useUpdateAttendanceRecord() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      recordId,
      status,
      notes,
    }: {
      recordId: string
      status: string
      notes?: string
    }) => {
      await attendanceService.updateAttendanceRecord(recordId, status, notes)
    },
    onSuccess: () => {
      // Invalidate all history queries as the record could be in any session
      queryClient.invalidateQueries(attendanceKeys.history())
      toast.success('Attendance record updated')
    },
    onError: (error) => {
      console.error('Error updating attendance record:', error)
      if (error instanceof ApiError) {
        toast.error(error.message || 'Failed to update attendance record')
      } else {
        toast.error('An unexpected error occurred')
      }
    },
  })
}

/**
 * Hook for deleting an attendance session
 */
export function useDeleteAttendanceSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sessionId: string) =>
      attendanceService.deleteSession(sessionId),
    onSuccess: () => {
      // Invalidate all history queries
      queryClient.invalidateQueries(attendanceKeys.history())
      toast.success('Attendance session deleted')
    },
    onError: (error) => {
      console.error('Error deleting session:', error)
      if (error instanceof ApiError) {
        toast.error(error.message || 'Failed to delete session')
      } else {
        toast.error('An unexpected error occurred')
      }
    },
  })
}

/**
 * Hook for fetching session summary
 */
export function useSessionSummary(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? attendanceKeys.session(sessionId) : null,
    queryFn: () => attendanceService.getSessionSummary(sessionId!),
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  })
}
