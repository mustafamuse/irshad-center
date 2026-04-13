import type { TeacherCheckinWithRelations } from '@/lib/db/queries/teacher-checkin'

import type { CheckinRecordDto } from './contracts'

export function mapCheckinToDto(
  checkin: TeacherCheckinWithRelations
): CheckinRecordDto {
  return {
    id: checkin.id,
    teacherId: checkin.teacherId,
    teacherName: checkin.teacher.person.name,
    date: checkin.date.toISOString().split('T')[0],
    shift: checkin.shift,
    clockInTime: checkin.clockInTime.toISOString(),
    clockOutTime: checkin.clockOutTime?.toISOString() ?? null,
    isLate: checkin.isLate,
    clockInValid: checkin.clockInValid,
    notes: checkin.notes,
  }
}
