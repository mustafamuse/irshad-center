'use client'

import { useMemo, useState } from 'react'

import { Shift } from '@prisma/client'

import { useTeachersDropdownQuery } from '@/lib/features/attendance/hooks/admin'

import {
  FilterOption,
  generateHistoryFilterOptions,
  getThisMonthRange,
} from './date-utils'

export interface CheckinFiltersState {
  isLoading: boolean
  teachers: { id: string; name: string }[]
  teachersError: string | null
  shiftFilter: Shift | 'all'
  teacherFilter: string | 'all'
  selectedHistoryFilter: string
  dateRange: { start: Date; end: Date }
  historyFilterOptions: { months: FilterOption[]; quarters: FilterOption[] }
  allHistoryOptions: FilterOption[]
}

export interface CheckinFiltersActions {
  setShiftFilter: (value: Shift | 'all') => void
  setTeacherFilter: (value: string | 'all') => void
  handleHistoryFilterChange: (value: string) => void
}

export function useCheckinFilters(): CheckinFiltersState &
  CheckinFiltersActions {
  const [shiftFilter, setShiftFilter] = useState<Shift | 'all'>('all')
  const [teacherFilter, setTeacherFilter] = useState<string | 'all'>('all')
  const [selectedHistoryFilter, setSelectedHistoryFilter] =
    useState('this-month')
  const [dateRange, setDateRange] = useState(() => getThisMonthRange())

  const teachersQuery = useTeachersDropdownQuery()

  const historyFilterOptions = useMemo(() => generateHistoryFilterOptions(), [])
  const allHistoryOptions = useMemo(
    () => [...historyFilterOptions.months, ...historyFilterOptions.quarters],
    [historyFilterOptions]
  )

  function handleHistoryFilterChange(value: string) {
    const option = allHistoryOptions.find((o) => o.value === value)
    if (option) {
      setSelectedHistoryFilter(value)
      setDateRange({ start: option.start, end: option.end })
    }
  }

  return {
    isLoading: teachersQuery.isLoading,
    teachers: teachersQuery.data ?? [],
    teachersError: teachersQuery.error?.message ?? null,
    shiftFilter,
    teacherFilter,
    selectedHistoryFilter,
    dateRange,
    historyFilterOptions,
    allHistoryOptions,
    setShiftFilter,
    setTeacherFilter,
    handleHistoryFilterChange,
  }
}
