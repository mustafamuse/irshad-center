import { Shift, DugsiAttendanceStatus } from '@prisma/client'

export interface DugsiClassDTO {
  id: string
  name: string
  shift: Shift
  description: string | null
  isActive: boolean
  studentCount: number
  createdAt: Date
}

export interface CreateDugsiClassInput {
  name: string
  shift: Shift
  description?: string
}

export interface UpdateDugsiClassInput {
  name?: string
  shift?: Shift
  description?: string
  isActive?: boolean
}

export interface ClassEnrollmentDTO {
  id: string
  classId: string
  className: string
  programProfileId: string
  studentName: string
  startDate: Date
  endDate: Date | null
  isActive: boolean
}

export interface AssignStudentInput {
  classId: string
  programProfileId: string
}

export interface ClassStudentDTO {
  enrollmentId: string
  programProfileId: string
  studentName: string
  startDate: Date
  isActive: boolean
}

export interface AttendanceSessionDTO {
  id: string
  date: Date
  classId: string
  className: string
  teacherId: string
  teacherName: string
  notes: string | null
  isClosed: boolean
  recordCount: number
  presentCount: number
  absentCount: number
}

export interface CreateSessionInput {
  classId: string
  teacherId: string
  date?: Date
  notes?: string
}

export interface AttendanceRecordDTO {
  id: string
  sessionId: string
  programProfileId: string
  studentName: string
  status: DugsiAttendanceStatus
  lessonCompleted: boolean
  surahName: string | null
  ayatFrom: number | null
  ayatTo: number | null
  lessonNotes: string | null
  notes: string | null
  markedAt: Date
}

export interface MarkAttendanceInput {
  sessionId: string
  records: Array<{
    programProfileId: string
    status: DugsiAttendanceStatus
    lessonCompleted?: boolean
    surahName?: string
    ayatFrom?: number
    ayatTo?: number
    lessonNotes?: string
    notes?: string
  }>
}

export interface StudentAttendanceStats {
  programProfileId: string
  studentName: string
  totalSessions: number
  presentCount: number
  absentCount: number
  lateCount: number
  excusedCount: number
  attendanceRate: number
  lessonCompletionRate: number
}

export interface ClassAttendanceStats {
  classId: string
  className: string
  totalSessions: number
  averageAttendanceRate: number
  averageLessonCompletionRate: number
}

export interface TeacherCheckInDTO {
  id: string
  teacherId: string
  teacherName: string
  date: Date
  shift: Shift
  clockInTime: Date
  clockInValid: boolean
  clockOutTime: Date | null
  isLate: boolean
  notes: string | null
}

export interface ClockInInput {
  teacherId: string
  shift: Shift
  lat: number
  lng: number
}

export interface ClockOutInput {
  checkInId: string
  lat?: number
  lng?: number
}
