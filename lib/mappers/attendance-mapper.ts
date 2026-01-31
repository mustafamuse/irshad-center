import type { DugsiAttendanceStatus } from '@prisma/client'

export interface AttendanceRecordForMarking {
  programProfileId: string
  status: DugsiAttendanceStatus
  lessonCompleted: boolean
  surahName: string | null
  ayatFrom: number | null
  ayatTo: number | null
  lessonNotes: string | null
  notes: string | null
}
