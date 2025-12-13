'use client'

import { Shift } from '@prisma/client'

import { Badge } from '@/components/ui/badge'

interface ShiftBadgeProps {
  shift: Shift
  className?: string
}

export function ShiftBadge({ shift, className }: ShiftBadgeProps) {
  return (
    <Badge
      variant={shift === 'MORNING' ? 'default' : 'secondary'}
      className={className}
    >
      {shift === 'MORNING' ? 'Morning' : 'Afternoon'}
    </Badge>
  )
}
