// Local AttendanceStatus enum (schema enum was removed - incomplete feature)
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
  UNEXCUSED = 'UNEXCUSED',
}

export interface BaseRecord {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface Student extends BaseRecord {
  name: string
  email: string
  rollNumber?: string
  batchId: string
}

export interface AttendanceRecord extends BaseRecord {
  sessionId: string
  studentId: string
  status: AttendanceStatus
  notes?: string
}

export interface AttendanceSession extends BaseRecord {
  date: Date
  batchId: string
  notes?: string
  records: AttendanceRecord[]
  summary: AttendanceSummary
}

export interface AttendanceSummary {
  total: number
  present: number
  absent: number
  late: number
  excused: number
}

export interface AttendanceFilters {
  batchId?: string
  startDate?: Date
  endDate?: Date
}

export interface MarkAttendanceData {
  date: Date
  batchId: string
  records: Array<{
    studentId: string
    status: AttendanceStatus
  }>
}

// Error Types
export interface ApiError extends Error {
  code?: string
  statusCode?: number
  data?: unknown
}

// State Types
export interface LoadingState {
  isLoading: boolean
  startedAt?: Date
  message?: string
}

export interface ErrorState {
  hasError: boolean
  error?: ApiError | null
  message?: string
}
