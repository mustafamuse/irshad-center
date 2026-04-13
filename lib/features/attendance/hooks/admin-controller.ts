'use client'

import { useMemo, useState } from 'react'

import type { Shift } from '@prisma/client'

import {
  generateHistoryFilterOptions,
  getThisMonthRange,
  getWeekendDates,
  generateWeekendDayOptions,
} from '@/app/admin/dugsi/teachers/components/date-utils'
import type { FilterOption } from '@/app/admin/dugsi/teachers/components/date-utils'

export type AdminViewMode = 'today' | 'history'

export interface AdminAttendanceControllerState {
  viewMode: AdminViewMode
  selectedDay: string
  selectedDate: Date
  selectedEndDate: Date | undefined
  shiftFilter: Shift | 'all'
  teacherFilter: string | 'all'
  historyPage: number
  selectedHistoryFilter: string
  dateRange: { start: Date; end: Date }
  weekendDayOptions: ReturnType<typeof generateWeekendDayOptions>
  historyFilterOptions: { months: FilterOption[]; quarters: FilterOption[] }
  allHistoryOptions: FilterOption[]
}

export interface AdminAttendanceControllerActions {
  setViewMode: (mode: AdminViewMode) => void
  setShiftFilter: (value: Shift | 'all') => void
  setTeacherFilter: (value: string | 'all') => void
  setHistoryPage: (page: number) => void
  handleDayChange: (value: string) => void
  handleHistoryFilterChange: (value: string) => void
}

export function useAdminAttendanceController(): AdminAttendanceControllerState &
  AdminAttendanceControllerActions {
  const [viewMode, setViewMode] = useState<AdminViewMode>('today')
  const [selectedDay, setSelectedDay] = useState('this-weekend')
  const [selectedDate, setSelectedDate] = useState(
    () => getWeekendDates(0).start
  )
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(
    () => getWeekendDates(0).end
  )
  const [shiftFilter, setShiftFilter] = useState<Shift | 'all'>('all')
  const [teacherFilter, setTeacherFilter] = useState<string | 'all'>('all')
  const [historyPage, setHistoryPage] = useState(1)
  const [selectedHistoryFilter, setSelectedHistoryFilter] =
    useState('this-month')
  const [dateRange, setDateRange] = useState(() => getThisMonthRange())

  const weekendDayOptions = useMemo(() => generateWeekendDayOptions(4), [])
  const historyFilterOptions = useMemo(() => generateHistoryFilterOptions(), [])
  const allHistoryOptions = useMemo(
    () => [...historyFilterOptions.months, ...historyFilterOptions.quarters],
    [historyFilterOptions]
  )

  function handleDayChange(value: string) {
    setSelectedDay(value)
    const option = weekendDayOptions.find((o) => o.value === value)
    if (option) {
      setSelectedDate(option.date)
      setSelectedEndDate(option.endDate)
    }
  }

  function handleHistoryFilterChange(value: string) {
    const option = allHistoryOptions.find((o) => o.value === value)
    if (option) {
      setSelectedHistoryFilter(value)
      setDateRange({ start: option.start, end: option.end })
      setHistoryPage(1)
    }
  }

  return {
    viewMode,
    selectedDay,
    selectedDate,
    selectedEndDate,
    shiftFilter,
    teacherFilter,
    historyPage,
    selectedHistoryFilter,
    dateRange,
    weekendDayOptions,
    historyFilterOptions,
    allHistoryOptions,
    setViewMode,
    setShiftFilter,
    setTeacherFilter,
    setHistoryPage,
    handleDayChange,
    handleHistoryFilterChange,
  }
}
