'use client'

import { Shift } from '@prisma/client'
import { Sun, Sunset, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useDugsiUIStore } from '../../store'

export function QuickFilterChips() {
  const quickShift = useDugsiUIStore((state) => state.filters.quickShift)
  const setQuickShiftFilter = useDugsiUIStore(
    (state) => state.setQuickShiftFilter
  )

  const handleShiftClick = (shift: Shift) => {
    setQuickShiftFilter(quickShift === shift ? null : shift)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        Quick filters:
      </span>

      <Badge
        variant={quickShift === 'MORNING' ? 'default' : 'outline'}
        className={cn(
          'cursor-pointer gap-1 transition-colors',
          quickShift === 'MORNING' && 'bg-amber-500 hover:bg-amber-600'
        )}
        onClick={() => handleShiftClick('MORNING')}
      >
        <Sun className="h-3 w-3" />
        Morning
        {quickShift === 'MORNING' && <X className="ml-0.5 h-3 w-3" />}
      </Badge>

      <Badge
        variant={quickShift === 'AFTERNOON' ? 'default' : 'outline'}
        className={cn(
          'cursor-pointer gap-1 transition-colors',
          quickShift === 'AFTERNOON' && 'bg-teal-600 hover:bg-teal-700'
        )}
        onClick={() => handleShiftClick('AFTERNOON')}
      >
        <Sunset className="h-3 w-3" />
        Afternoon
        {quickShift === 'AFTERNOON' && <X className="ml-0.5 h-3 w-3" />}
      </Badge>

      {quickShift && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setQuickShiftFilter(null)}
        >
          Clear
        </Button>
      )}
    </div>
  )
}
