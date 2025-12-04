'use client'

import { StudentShift } from '@prisma/client'

import { Badge } from '@/components/ui/badge'
import { SHIFT_BADGES } from '@/lib/constants/dugsi'

interface ShiftBadgeProps {
  shift: StudentShift | null
  className?: string
}

export function ShiftBadge({ shift, className }: ShiftBadgeProps) {
  if (!shift) {
    return <span className="text-xs text-muted-foreground">Not Set</span>
  }

  return (
    <Badge
      variant="outline"
      className={`${SHIFT_BADGES[shift].className} ${className || ''}`}
    >
      {SHIFT_BADGES[shift].label}
    </Badge>
  )
}
