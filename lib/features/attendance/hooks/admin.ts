'use client'

import { Shift } from '@prisma/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'


import { attendanceFetch } from '../client'
import type {
  AdminAttendanceGridDto,
  CheckinRecordDto,
  ClosureDto,
  ExcuseQueueItemDto,
  MutationResultDto,
  TeacherDropdownItemDto,
} from '../contracts'
import { type AdminGridFilters, attendanceKeys } from '../query-keys'

// ————————————————————————————————————————
// Read hooks
// ————————————————————————————————————————

export function useAdminGridQuery(filters: AdminGridFilters) {
  const params = new URLSearchParams()
  if (filters.date) params.set('date', filters.date)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.shift && filters.shift !== 'all')
    params.set('shift', filters.shift)
  if (filters.teacherId && filters.teacherId !== 'all')
    params.set('teacherId', filters.teacherId)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize))

  return useQuery({
    queryKey: attendanceKeys.adminGrid(filters),
    queryFn: () =>
      attendanceFetch<AdminAttendanceGridDto>(
        `/api/admin/attendance/grid?${params.toString()}`
      ),
    staleTime: 30_000,
  })
}

export function useTeachersDropdownQuery() {
  return useQuery({
    queryKey: attendanceKeys.teachersDropdown(),
    queryFn: () =>
      attendanceFetch<TeacherDropdownItemDto[]>(
        '/api/admin/attendance/teachers'
      ),
    staleTime: 5 * 60_000,
  })
}

export function useAdminCheckinHistoryQuery(teacherId: string, page: number) {
  return useQuery({
    queryKey: attendanceKeys.adminCheckinHistory(teacherId, page),
    queryFn: () =>
      attendanceFetch<AdminAttendanceGridDto>(
        `/api/admin/attendance/checkin-history?teacherId=${encodeURIComponent(teacherId)}&page=${page}`
      ),
    enabled: !!teacherId,
    staleTime: 30_000,
  })
}

// ————————————————————————————————————————
// Mutation hooks
// ————————————————————————————————————————

interface UpdateCheckinBody {
  clockInTime?: string
  clockOutTime?: string | null
  isLate?: boolean
  clockInValid?: boolean
  notes?: string | null
}

export function useUpdateCheckinMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...body }: UpdateCheckinBody & { id: string }) =>
      attendanceFetch<CheckinRecordDto>(
        `/api/admin/attendance/checkins/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.admin(),
      })
    },
  })
}

export function useDeleteCheckinMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      attendanceFetch<MutationResultDto>(
        `/api/admin/attendance/checkins/${id}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.admin(),
      })
    },
  })
}

// ————————————————————————————————————————
// Closures hooks
// ————————————————————————————————————————

export function useAdminClosuresQuery(month?: string) {
  const params = month ? `?month=${encodeURIComponent(month)}` : ''
  return useQuery({
    queryKey: attendanceKeys.adminClosures(month ?? 'all'),
    queryFn: () =>
      attendanceFetch<ClosureDto[]>(`/api/admin/attendance/closures${params}`),
    staleTime: 60_000,
  })
}

export function useMarkClosureMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ date, reason }: { date: string; reason: string }) =>
      attendanceFetch<ClosureDto>('/api/admin/attendance/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, reason }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.admin(),
      })
    },
  })
}

export function useRemoveClosureMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (date: string) =>
      attendanceFetch<{ ok: true; reopenedCount: number }>(
        `/api/admin/attendance/closures?date=${encodeURIComponent(date)}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.admin(),
      })
    },
  })
}

// ————————————————————————————————————————
// Excuse queue hooks
// ————————————————————————————————————————

export function useAdminExcuseQueueQuery() {
  return useQuery({
    queryKey: attendanceKeys.adminExcuseQueue(),
    queryFn: () =>
      attendanceFetch<ExcuseQueueItemDto[]>(
        '/api/admin/attendance/excuse-queue'
      ),
    staleTime: 30_000,
  })
}

export function useReviewExcuseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      action,
      excuseRequestId,
      adminNote,
    }: {
      action: 'approve' | 'reject'
      excuseRequestId: string
      adminNote?: string
    }) =>
      attendanceFetch<MutationResultDto>('/api/admin/attendance/excuse-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, excuseRequestId, adminNote }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.adminExcuseQueue(),
      })
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.admin(),
      })
    },
  })
}

// Re-export for convenience
export type { AdminGridFilters, Shift }
