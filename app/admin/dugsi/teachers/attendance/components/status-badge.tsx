import { TeacherAttendanceStatus } from '@prisma/client'

import { Badge } from '@/components/ui/badge'
import { ATTENDANCE_STATUS_CONFIG } from '@/lib/constants/attendance-status'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = ATTENDANCE_STATUS_CONFIG

interface Props {
  status: TeacherAttendanceStatus
  minutesLate?: number | null
  className?: string
}

export function AttendanceStatusBadge({ status, minutesLate, className }: Props) {
  const config = STATUS_CONFIG[status]
  const label =
    status === 'LATE' && minutesLate
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

export { STATUS_CONFIG }
