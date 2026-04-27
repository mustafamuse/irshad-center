import {
  AttendanceSource,
  ExcuseRequestStatus,
  Shift,
  TeacherAttendanceStatus,
} from '@prisma/client'

export type ClosureDto = {
  id: string
  date: string // yyyy-MM-dd (UTC)
  reason: string
}

export type ExcuseQueueItemDto = {
  id: string
  attendanceRecordId: string
  teacherName: string
  date: string // yyyy-MM-dd (UTC)
  shift: Shift
  recordStatus: TeacherAttendanceStatus
  reason: string
  createdAt: string // ISO datetime
}

// ————————————————————————————————————————
// Teacher DTOs
// ————————————————————————————————————————

export type TeacherContextDto = {
  teacherId: string
  todayDate: string // yyyy-MM-dd, computed server-side using SCHOOL_TIMEZONE
  shifts: Shift[]
  morningCheckinId: string | null
  morningClockInTime: string | null // ISO datetime
  morningClockOutTime: string | null
  afternoonCheckinId: string | null
  afternoonClockInTime: string | null
  afternoonClockOutTime: string | null
  sessionToken: string | null // null when Phase 2 is disabled
}

export type ExcuseDto = {
  id: string
  status: ExcuseRequestStatus
  reason: string
}

export type TeacherCheckinHistoryItemDto = {
  id: string
  date: string // yyyy-MM-dd
  shift: Shift
  status: TeacherAttendanceStatus
  source: AttendanceSource
  minutesLate: number | null
  clockInTime: string | null // ISO datetime
  pendingExcuseId: string | null
  wasExcuseRejected: boolean
  excuse?: ExcuseDto // Phase 2 extension slot
}

export type TeacherCheckinHistoryDto = {
  records: TeacherCheckinHistoryItemDto[]
  monthlyExcuseCount: number
}

// ————————————————————————————————————————
// Admin DTOs
// ————————————————————————————————————————

export type CheckinRecordDto = {
  id: string
  teacherId: string
  teacherName: string
  date: string // yyyy-MM-dd
  shift: Shift
  clockInTime: string // ISO datetime
  clockOutTime: string | null
  isLate: boolean
  clockInValid: boolean
  notes: string | null
}

export type AdminAttendanceGridDto = {
  data: CheckinRecordDto[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type TeacherDropdownItemDto = {
  id: string
  name: string
}

export type MutationResultDto = {
  ok: true
}
