import { DugsiAttendanceStatus, Shift } from '@prisma/client'

export { DugsiAttendanceStatus }

export type { AttendanceRecordForMarking } from '@/lib/mappers/attendance-mapper'

export interface AttendanceRecord {
  id: string
  sessionId: string
  programProfileId: string
  status: DugsiAttendanceStatus
  lessonCompleted: boolean
  surahName: string | null
  ayatFrom: number | null
  ayatTo: number | null
  lessonNotes: string | null
  notes: string | null
  markedAt: Date | null
  createdAt: Date
  updatedAt: Date
  profile: {
    id: string
    person: {
      id: string
      name: string
    }
  }
}

export interface AttendanceSession {
  id: string
  date: Date
  classId: string
  teacherId: string
  notes: string | null
  isClosed: boolean
  createdAt: Date
  updatedAt: Date
  class: {
    id: string
    name: string
    shift: Shift
  }
  teacher: {
    id: string
    person: {
      id: string
      name: string
    }
  }
  records: AttendanceRecord[]
}

export interface AttendanceSummary {
  total: number
  present: number
  absent: number
  late: number
  excused: number
}

export interface AttendanceFilters {
  classId?: string
  dateFrom?: Date
  dateTo?: Date
}
