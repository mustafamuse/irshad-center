'use client'

import { Shift } from '@prisma/client'
import { Sun, Sunset } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { SHIFT_BADGES } from '@/lib/constants/dugsi'
import { cn } from '@/lib/utils'

interface ShiftBadgeProps {
  shift: Shift | null
  className?: string
  showIcon?: boolean
}

export function ShiftBadge({
  shift,
  className,
  showIcon = true,
}: ShiftBadgeProps) {
  if (!shift) {
    return <span className="text-xs text-muted-foreground">Not Set</span>
  }

  const Icon = shift === 'MORNING' ? Sun : Sunset
  const iconColor = shift === 'MORNING' ? 'text-[#deb43e]' : 'text-[#007078]'

  return (
    <Badge
      variant="outline"
      className={cn('gap-1', SHIFT_BADGES[shift].className, className)}
    >
      {showIcon && <Icon className={cn('h-3 w-3', iconColor)} />}
      {SHIFT_BADGES[shift].label}
    </Badge>
  )
}
