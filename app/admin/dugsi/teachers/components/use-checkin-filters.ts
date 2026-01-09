'use client'

import { useCallback, useMemo, useState, useTransition, useEffect } from 'react'

import { Shift } from '@prisma/client'

import { TeacherOption, getTeachersForDropdownAction } from '../actions'
import {
  FilterOption,
  generateHistoryFilterOptions,
  getThisMonthRange,
} from './date-utils'

export interface CheckinFiltersState {
  isPending: boolean
  teachers: TeacherOption[]
  teachersError: string | null
  shiftFilter: Shift | 'all'
  teacherFilter: string | 'all'
  selectedHistoryFilter: string
  dateRange: { start: Date; end: Date }
  historyFilterOptions: { months: FilterOption[]; quarters: FilterOption[] }
  allHistoryOptions: FilterOption[]
}

export interface CheckinFiltersActions {
  startTransition: (callback: () => void) => void
  setShiftFilter: (value: Shift | 'all') => void
  setTeacherFilter: (value: string | 'all') => void
  handleHistoryFilterChange: (value: string) => void
}

export function useCheckinFilters(): CheckinFiltersState &
  CheckinFiltersActions {
  const [isPending, startTransition] = useTransition()
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [teachersError, setTeachersError] = useState<string | null>(null)
  const [shiftFilter, setShiftFilter] = useState<Shift | 'all'>('all')
  const [teacherFilter, setTeacherFilter] = useState<string | 'all'>('all')
  const [selectedHistoryFilter, setSelectedHistoryFilter] =
    useState('this-month')
  const [dateRange, setDateRange] = useState(() => getThisMonthRange())

  const historyFilterOptions = useMemo(() => generateHistoryFilterOptions(), [])
  const allHistoryOptions = useMemo(
    () => [...historyFilterOptions.months, ...historyFilterOptions.quarters],
    [historyFilterOptions]
  )

  const loadTeachers = useCallback(() => {
    startTransition(async () => {
      const result = await getTeachersForDropdownAction()
      if (result.success && result.data) {
        setTeachers(result.data)
        setTeachersError(null)
      } else {
        setTeachersError(result.error || 'Failed to load teachers')
      }
    })
  }, [])

  useEffect(() => {
    loadTeachers()
  }, [loadTeachers])

  function handleHistoryFilterChange(value: string) {
    const option = allHistoryOptions.find((o) => o.value === value)
    if (option) {
      setSelectedHistoryFilter(value)
      setDateRange({ start: option.start, end: option.end })
    }
  }

  return {
    isPending,
    teachers,
    teachersError,
    shiftFilter,
    teacherFilter,
    selectedHistoryFilter,
    dateRange,
    historyFilterOptions,
    allHistoryOptions,
    startTransition,
    setShiftFilter,
    setTeacherFilter,
    handleHistoryFilterChange,
  }
}
