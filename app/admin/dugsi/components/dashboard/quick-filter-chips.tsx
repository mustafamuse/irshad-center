'use client'

import { Shift } from '@prisma/client'
import { Sun, Sunset, User, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { Family } from '../../_types'
import { useDugsiUIStore } from '../../store'

interface QuickFilterChipsProps {
  families: Family[]
}

export function QuickFilterChips({ families }: QuickFilterChipsProps) {
  const quickShift = useDugsiUIStore((state) => state.filters.quickShift)
  const quickTeacher = useDugsiUIStore((state) => state.filters.quickTeacher)
  const setQuickShiftFilter = useDugsiUIStore(
    (state) => state.setQuickShiftFilter
  )
  const setQuickTeacherFilter = useDugsiUIStore(
    (state) => state.setQuickTeacherFilter
  )

  const uniqueTeachers = Array.from(
    new Set(
      families
        .flatMap((f) => f.members)
        .map((m) => m.teacherName)
        .filter((name): name is string => !!name)
    )
  ).sort()

  const hasActiveFilters = quickShift || quickTeacher

  const handleShiftClick = (shift: Shift) => {
    setQuickShiftFilter(quickShift === shift ? null : shift)
  }

  const handleTeacherClick = (teacher: string) => {
    setQuickTeacherFilter(quickTeacher === teacher ? null : teacher)
  }

  const clearFilters = () => {
    setQuickShiftFilter(null)
    setQuickTeacherFilter(null)
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

      {uniqueTeachers.length > 0 && (
        <>
          <div className="mx-1 h-4 w-px bg-border" />
          {uniqueTeachers.slice(0, 3).map((teacher) => (
            <Badge
              key={teacher}
              variant={quickTeacher === teacher ? 'default' : 'outline'}
              className="cursor-pointer gap-1 transition-colors"
              onClick={() => handleTeacherClick(teacher)}
            >
              <User className="h-3 w-3" />
              {teacher.split(' ')[0]}
              {quickTeacher === teacher && <X className="ml-0.5 h-3 w-3" />}
            </Badge>
          ))}
        </>
      )}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={clearFilters}
        >
          Clear filters
        </Button>
      )}
    </div>
  )
}
