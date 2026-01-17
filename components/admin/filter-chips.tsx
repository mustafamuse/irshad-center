'use client'

import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FilterChip {
  value: string
  label: string
  count?: number
  variant?: 'default' | 'warning' | 'destructive' | 'success'
}

interface FilterChipsProps {
  chips: FilterChip[]
  activeChip: string
  onChipChange: (chip: string) => void | Promise<unknown>
  className?: string
}

const variantStyles: Record<string, string> = {
  default: 'bg-primary hover:bg-primary/90',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  destructive: 'bg-destructive hover:bg-destructive/90',
  success: 'bg-green-600 hover:bg-green-700 text-white',
}

export function FilterChips({
  chips,
  activeChip,
  onChipChange,
  className,
}: FilterChipsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => {
        const isActive = activeChip === chip.value
        const variant = chip.variant ?? 'default'

        return (
          <Badge
            key={chip.value}
            variant={isActive ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer gap-1 transition-colors',
              isActive && variantStyles[variant]
            )}
            onClick={() => onChipChange(chip.value)}
          >
            {chip.label}
            {chip.count !== undefined && (
              <span className="text-xs opacity-75">({chip.count})</span>
            )}
            {isActive && chip.value !== 'all' && (
              <X className="ml-0.5 h-3 w-3" />
            )}
          </Badge>
        )
      })}
    </div>
  )
}
