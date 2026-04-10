import { AttendanceSource, TeacherAttendanceStatus } from '@prisma/client'

import { Badge } from '@/components/ui/badge'
import { ATTENDANCE_STATUS_CONFIG } from '@/lib/constants/attendance-status'
import { cn } from '@/lib/utils'

interface Props {
  status: TeacherAttendanceStatus
  source?: AttendanceSource | null
  minutesLate?: number | null
  className?: string
}

export function AttendanceStatusBadge({ status, source, minutesLate, className }: Props) {
  const config = ATTENDANCE_STATUS_CONFIG[status]
  const label =
    status === 'LATE' && source === 'AUTO_MARKED'
      ? 'Late (auto)'
      : status === 'LATE' && minutesLate
        ? `Late +${minutesLate}m`
        : config.label

  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', config.className, className)}
    >
      {label}
    </Badge>
  )
}
