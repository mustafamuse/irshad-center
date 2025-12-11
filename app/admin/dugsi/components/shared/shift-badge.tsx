'use client'

import { Shift } from '@prisma/client'

import { Badge } from '@/components/ui/badge'
import { SHIFT_BADGES } from '@/lib/constants/dugsi'
import { cn } from '@/lib/utils'

interface ShiftBadgeProps {
  shift: Shift | null
  className?: string
}

export function ShiftBadge({ shift, className }: ShiftBadgeProps) {
  if (!shift) {
    return <span className="text-xs text-muted-foreground">Not Set</span>
  }

  return (
    <Badge
      variant="outline"
      className={cn(SHIFT_BADGES[shift].className, className)}
    >
      {SHIFT_BADGES[shift].label}
    </Badge>
  )
}
