import { Shift } from '@prisma/client'

import type {
  TeacherCheckinWithRelations,
  TeacherWithCheckinStatus,
} from '@/lib/db/queries/teacher-checkin'

export type { TeacherCheckinWithRelations, TeacherWithCheckinStatus }

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface CheckinFilters {
  dateFrom?: string
  dateTo?: string
  shift?: Shift
  teacherId?: string
  isLate?: boolean
}

export interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface LateByTeacher {
  teacherId: string
  teacherName: string
  lateCount: number
  checkins: TeacherCheckinWithRelations[]
}

export interface LateByDate {
  date: string
  lateCount: number
  checkins: TeacherCheckinWithRelations[]
}

export type LateReportViewMode = 'by-teacher' | 'by-date'
