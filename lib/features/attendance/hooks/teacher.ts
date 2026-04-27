'use client'

import { Shift } from '@prisma/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { AttendanceFetchError, attendanceFetch } from '../client'
import type {
  CheckinRecordDto,
  TeacherCheckinHistoryDto,
  TeacherContextDto,
} from '../contracts'
import { attendanceKeys } from '../query-keys'

// ————————————————————————————————————————
// Read hooks
// ————————————————————————————————————————

export function useTeacherContextQuery(teacherId: string | null) {
  return useQuery({
    queryKey: attendanceKeys.teacherContext(teacherId ?? ''),
    queryFn: () =>
      attendanceFetch<TeacherContextDto>(
        `/api/teacher/checkin/context?teacherId=${encodeURIComponent(teacherId!)}`
      ),
    enabled: !!teacherId,
    staleTime: 30_000,
  })
}

interface TeacherCheckinHistoryParams {
  teacherId: string | null
  sessionToken: string | null
  enabled: boolean
  phase2Enabled: boolean
}

export function useTeacherCheckinHistoryQuery({
  teacherId,
  sessionToken,
  enabled,
  phase2Enabled,
}: TeacherCheckinHistoryParams) {
  return useQuery({
    queryKey: attendanceKeys.teacherCheckinHistory(teacherId ?? '', 'phase2'),
    queryFn: () =>
      attendanceFetch<TeacherCheckinHistoryDto>(
        '/api/teacher/checkin/checkin-history',
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      ),
    enabled: !!teacherId && enabled && phase2Enabled && !!sessionToken,
    staleTime: 60_000,
  })
}

// ————————————————————————————————————————
// Mutation hooks
// ————————————————————————————————————————

interface ClockInParams {
  shift: Shift
  latitude: number
  longitude: number
}

export function useClockInMutation(teacherId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ClockInParams) =>
      attendanceFetch<{ checkInId: string; message: string }>(
        '/api/teacher/checkin/clock-in',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacherId, ...data }),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.teacherContext(teacherId),
      })
    },
  })
}

interface ClockOutParams {
  checkInId: string
  latitude: number
  longitude: number
}

export function useClockOutMutation(teacherId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ClockOutParams) =>
      attendanceFetch<{ message: string }>('/api/teacher/checkin/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId, ...data }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.teacherContext(teacherId),
      })
    },
  })
}

interface SubmitExcuseParams {
  attendanceRecordId: string
  reason: string
}

export function useSubmitExcuseMutation(
  teacherId: string,
  sessionToken: string
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SubmitExcuseParams) =>
      attendanceFetch<{ excuseRequestId: string }>(
        '/api/teacher/checkin/excuses',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.teacherCheckinHistory(teacherId, 'phase2'),
      })
    },
    onError: (error: unknown) => {
      if (error instanceof AttendanceFetchError && error.status === 403) {
      }
    },
  })
}

export function useGetSessionMutation() {
  return useMutation({
    mutationFn: (payload: { teacherId: string; pin: string }) =>
      attendanceFetch<{ token: string }>('/api/teacher/checkin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
  })
}

// Re-export for convenience
export type { ClockInParams, ClockOutParams, CheckinRecordDto }
