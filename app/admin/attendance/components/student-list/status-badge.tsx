'use client'

import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        {
          'bg-green-100 text-green-700': status === 'present',
          'bg-red-100 text-red-700': status === 'absent',
          'bg-yellow-100 text-yellow-700': status === 'late',
          'bg-blue-100 text-blue-700': status === 'excused',
        },
        className
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
