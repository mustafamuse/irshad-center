import type { Shift } from '@prisma/client'

export interface AdminGridFilters {
  date?: string
  dateTo?: string
  dateFrom?: string
  shift?: Shift | 'all'
  teacherId?: string | 'all'
  page?: number
  pageSize?: number
}

export const attendanceKeys = {
  all: ['attendance'] as const,

  teacherContext: (teacherId: string) =>
    ['attendance', 'teacher', teacherId, 'context'] as const,

  teacherCheckinHistory: (teacherId: string, variant: 'basic' | 'phase2') =>
    ['attendance', 'teacher', teacherId, 'history', variant] as const,

  admin: () => ['attendance', 'admin'] as const,

  adminGrid: (filters: AdminGridFilters) =>
    ['attendance', 'admin', 'grid', filters] as const,

  adminCheckinHistory: (teacherId: string, page: number) =>
    ['attendance', 'admin', 'checkin-history', teacherId, page] as const,

  teachersDropdown: () => ['attendance', 'admin', 'teachers'] as const,

  adminClosures: (month: string) =>
    ['attendance', 'admin', 'closures', month] as const,

  adminExcuseQueue: () => ['attendance', 'admin', 'excuses'] as const,
}
