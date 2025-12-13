'use client'

import { DugsiAttendanceStatus } from '@prisma/client'

import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG: Record<
  DugsiAttendanceStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
> = {
  PRESENT: { label: 'Present', variant: 'default' },
  ABSENT: { label: 'Absent', variant: 'destructive' },
  LATE: { label: 'Late', variant: 'secondary' },
  EXCUSED: { label: 'Excused', variant: 'outline' },
}

interface AttendanceBadgeProps {
  status: DugsiAttendanceStatus
  className?: string
}

export function AttendanceBadge({ status, className }: AttendanceBadgeProps) {
  const { label, variant } = STATUS_CONFIG[status]

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}
