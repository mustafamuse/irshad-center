'use client'

import { Shift } from '@prisma/client'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { TeacherOption } from '../actions'

const SHIFT_OPTIONS: { value: Shift | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'MORNING', label: 'AM' },
  { value: 'AFTERNOON', label: 'PM' },
]

interface FilterControlsProps {
  shiftFilter: Shift | 'all'
  onShiftChange: (value: Shift | 'all') => void
  teacherFilter: string | 'all'
  onTeacherChange: (value: string | 'all') => void
  teachers: TeacherOption[]
  teachersError?: string | null
  onRefresh: () => void
  isPending: boolean
}

export function FilterControls({
  shiftFilter,
  onShiftChange,
  teacherFilter,
  onTeacherChange,
  teachers,
  teachersError,
  onRefresh,
  isPending,
}: FilterControlsProps) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-2 sm:flex sm:items-center">
      <div
        role="group"
        aria-label="Shift filter"
        className="flex rounded-lg border p-1"
      >
        {SHIFT_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={shiftFilter === opt.value ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onShiftChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <Select
        value={teacherFilter}
        onValueChange={(value) => onTeacherChange(value as string | 'all')}
        disabled={!!teachersError}
      >
        <SelectTrigger
          className={cn(
            'w-full sm:w-[160px]',
            teachersError && 'border-red-300'
          )}
        >
          <SelectValue
            placeholder={teachersError ? 'Failed to load' : 'Teacher'}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Teachers</SelectItem>
          {teachers.map((teacher) => (
            <SelectItem key={teacher.id} value={teacher.id}>
              {teacher.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={onRefresh}
        disabled={isPending}
        aria-label="Refresh"
      >
        <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
      </Button>
    </div>
  )
}
