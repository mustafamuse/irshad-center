'use client'

import { DugsiAttendanceStatus } from '@prisma/client'
import { Check, X, Clock, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AttendanceButtonProps {
  status: DugsiAttendanceStatus | null
  onStatusChange: (status: DugsiAttendanceStatus) => void
  disabled?: boolean
  variant?: 'desktop' | 'mobile'
}

const STATUS_CONFIG = {
  PRESENT: {
    label: 'Present',
    shortLabel: 'P',
    icon: Check,
    activeClass: 'bg-green-600 text-white hover:bg-green-700 border-green-600',
    inactiveClass:
      'hover:bg-green-50 hover:text-green-700 hover:border-green-300',
  },
  ABSENT: {
    label: 'Absent',
    shortLabel: 'A',
    icon: X,
    activeClass: 'bg-red-600 text-white hover:bg-red-700 border-red-600',
    inactiveClass: 'hover:bg-red-50 hover:text-red-700 hover:border-red-300',
  },
  LATE: {
    label: 'Late',
    shortLabel: 'L',
    icon: Clock,
    activeClass:
      'bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-500',
    inactiveClass:
      'hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300',
  },
  EXCUSED: {
    label: 'Excused',
    shortLabel: 'E',
    icon: ShieldCheck,
    activeClass: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600',
    inactiveClass: 'hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300',
  },
} as const

const STATUSES = Object.keys(STATUS_CONFIG) as DugsiAttendanceStatus[]

export function AttendanceButton({
  status,
  onStatusChange,
  disabled = false,
  variant = 'desktop',
}: AttendanceButtonProps) {
  return (
    <div
      className={cn(
        'flex gap-1',
        variant === 'mobile' ? 'flex-wrap justify-center' : ''
      )}
    >
      {STATUSES.map((s) => {
        const config = STATUS_CONFIG[s]
        const isActive = status === s
        const Icon = config.icon

        return (
          <Button
            key={s}
            variant="outline"
            size={variant === 'mobile' ? 'default' : 'sm'}
            onClick={() => onStatusChange(s)}
            disabled={disabled}
            className={cn(
              'transition-all',
              variant === 'mobile' ? 'min-w-[70px] flex-1' : 'min-w-[60px]',
              isActive ? config.activeClass : config.inactiveClass,
              disabled && 'opacity-50'
            )}
          >
            <Icon
              className={cn(
                'mr-1.5 h-3.5 w-3.5',
                variant === 'mobile' && 'h-4 w-4'
              )}
            />
            {variant === 'mobile' ? config.label : config.shortLabel}
          </Button>
        )
      })}
    </div>
  )
}
