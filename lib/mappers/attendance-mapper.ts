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

type AttendanceRecordInput = AttendanceRecordForMarking &
  Record<string, unknown>

export function mapRecordToMarkingDTO(
  record: AttendanceRecordInput
): AttendanceRecordForMarking {
  return {
    programProfileId: record.programProfileId,
    status: record.status,
    lessonCompleted: record.lessonCompleted,
    surahName: record.surahName,
    ayatFrom: record.ayatFrom,
    ayatTo: record.ayatTo,
    lessonNotes: record.lessonNotes,
    notes: record.notes,
  }
}

export function mapRecordsToMarkingDTOs(
  records: AttendanceRecordInput[]
): AttendanceRecordForMarking[] {
  return records.map(mapRecordToMarkingDTO)
}
