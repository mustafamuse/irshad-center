export interface AttendanceRecord {
  id: string
  studentId: string
  sessionId: string
  status: AttendanceStatus
  notes?: string
  createdAt: Date
  updatedAt: Date
  student: {
    id: string
    name: string
    email?: string
  }
  session: {
    id: string
    date: Date
    startTime: Date
    endTime: Date
    schedule: {
      subject: {
        name: string
      }
      batch: {
        name: string
      }
    }
  }
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  UNEXCUSED = 'UNEXCUSED',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
}

export interface AttendanceSession {
  id: string
  classScheduleId: string
  date: Date
  startTime: Date
  endTime: Date
  status: string
  notes?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  attendance: AttendanceRecord[]
  schedule: {
    id: string
    batch: {
      id: string
      name: string
      students: Array<{
        id: string
        name: string
        email?: string
      }>
    }
    subject: {
      id: string
      name: string
    }
    daysOfWeek: DayOfWeek[]
    startTime: string
    endTime: string
  }
  // Additional computed properties
  studentsCount: number
  attendanceMarked: number
  isComplete: boolean
}

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export interface AttendanceMarkRequest {
  studentId: string
  sessionId: string
  status: AttendanceStatus
  notes?: string
}

export interface BulkAttendanceRequest {
  sessionId: string
  attendanceRecords: Array<{
    studentId: string
    status: AttendanceStatus
    notes?: string
  }>
}

export interface WeekendSession {
  id: string
  date: Date
  startTime: Date
  endTime: Date
  subjectName: string
  batchName: string
  studentsCount: number
  attendanceMarked: number
  isComplete: boolean
}

export interface AttendanceStats {
  totalSessions: number
  completedSessions: number
  totalStudents: number
  averageAttendanceRate: number
  weekendSessionsCount: number
}

export interface AttendanceFilters {
  startDate?: Date
  endDate?: Date
  batchId?: string
  subjectId?: string
  status?: AttendanceStatus
  weekendsOnly?: boolean
}
