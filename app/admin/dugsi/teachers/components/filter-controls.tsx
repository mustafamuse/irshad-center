'use client'

import { Shift } from '@prisma/client'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { TeacherOption } from '../actions'
import { FilterOption } from './date-utils'

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
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:flex sm:items-center">
      <Select
        value={shiftFilter}
        onValueChange={(value) => onShiftChange(value as Shift | 'all')}
      >
        <SelectTrigger className="w-full sm:w-[130px]">
          <SelectValue placeholder="Shift" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Shifts</SelectItem>
          <SelectItem value="MORNING">Morning</SelectItem>
          <SelectItem value="AFTERNOON">Afternoon</SelectItem>
        </SelectContent>
      </Select>

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
      >
        <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
      </Button>
    </div>
  )
}

interface HistoryFilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: { months: FilterOption[]; quarters: FilterOption[] }
}

export function HistoryFilterSelect({
  value,
  onChange,
  options,
}: HistoryFilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="flex-1 sm:w-[180px]">
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Months</SelectLabel>
          {options.months.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Quarters</SelectLabel>
          {options.quarters.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
