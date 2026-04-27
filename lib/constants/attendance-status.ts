import { TeacherAttendanceStatus } from '@prisma/client'

export const ATTENDANCE_STATUS_CONFIG: Record<
  TeacherAttendanceStatus,
  { label: string; className: string }
> = {
  EXPECTED: { label: 'Expected', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  PRESENT:  { label: 'Present',  className: 'bg-green-100 text-green-800 border-green-200' },
  LATE:     { label: 'Late',     className: 'bg-orange-100 text-orange-800 border-orange-200' },
  ABSENT:   { label: 'Absent',   className: 'bg-red-100 text-red-800 border-red-200' },
  EXCUSED:  { label: 'Excused',  className: 'bg-blue-100 text-blue-800 border-blue-200' },
  CLOSED:   { label: 'Closed',   className: 'bg-slate-100 text-slate-500 border-slate-200 line-through' },
}
