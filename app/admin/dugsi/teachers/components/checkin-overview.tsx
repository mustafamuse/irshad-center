'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  addDays,
  getDay,
} from 'date-fns'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'

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

import {
  CheckinRecord,
  TeacherOption,
  getCheckinsForDateAction,
  getCheckinHistoryWithFiltersAction,
  getTeachersForDropdownAction,
} from '../actions'
import { CheckinCard } from './checkin-card'
import { CheckinTable } from './checkin-table'

interface Props {
  onDataChanged?: () => void
}

type ViewMode = 'today' | 'history'

interface WeekendDayOption {
  value: string
  label: string
  date: Date
}

interface FilterOption {
  value: string
  label: string
  start: Date
  end: Date
}

function getWeekendDates(weeksAgo: number): { start: Date; end: Date } {
  const now = new Date()
  const dayOfWeek = getDay(now)

  let daysToSaturday: number
  if (dayOfWeek === 6) {
    daysToSaturday = 0
  } else if (dayOfWeek === 0) {
    daysToSaturday = 1
  } else {
    daysToSaturday = dayOfWeek + 1
  }

  const saturday = subDays(now, daysToSaturday + weeksAgo * 7)
  const sunday = addDays(saturday, 1)

  return {
    start: startOfDay(saturday),
    end: endOfDay(sunday),
  }
}

function generateWeekendDayOptions(count: number): WeekendDayOption[] {
  const options: WeekendDayOption[] = []
  for (let i = 0; i < count; i++) {
    const { start, end } = getWeekendDates(i)
    const satLabel =
      i === 0
        ? `This Sat (${format(start, 'MMM d')})`
        : i === 1
          ? `Last Sat (${format(start, 'MMM d')})`
          : `Sat ${format(start, 'MMM d')}`
    const sunLabel =
      i === 0
        ? `This Sun (${format(end, 'MMM d')})`
        : i === 1
          ? `Last Sun (${format(end, 'MMM d')})`
          : `Sun ${format(end, 'MMM d')}`

    options.push({ value: `sat-${i}`, label: satLabel, date: start })
    options.push({ value: `sun-${i}`, label: sunLabel, date: startOfDay(end) })
  }
  return options
}

function getThisMonthRange(): { start: Date; end: Date } {
  const now = new Date()
  return {
    start: startOfMonth(now),
    end: endOfMonth(now),
  }
}

function getLastNMonthsRange(n: number): { start: Date; end: Date } {
  const now = new Date()
  return {
    start: startOfMonth(subMonths(now, n - 1)),
    end: endOfMonth(now),
  }
}

function getQuarterRange(
  year: number,
  quarter: 1 | 2 | 3 | 4
): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3
  const start = new Date(year, startMonth, 1)
  const end = endOfMonth(new Date(year, startMonth + 2, 1))
  return { start: startOfDay(start), end: endOfDay(end) }
}

function getAvailableQuarters(): { year: number; quarter: 1 | 2 | 3 | 4 }[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentQuarter = Math.floor(currentMonth / 3) + 1

  const quarters: { year: number; quarter: 1 | 2 | 3 | 4 }[] = []

  const monthInQuarter = currentMonth % 3
  if (monthInQuarter >= 1) {
    quarters.push({
      year: currentYear,
      quarter: currentQuarter as 1 | 2 | 3 | 4,
    })
  }

  for (let q = currentQuarter - 1; q >= 1; q--) {
    quarters.push({ year: currentYear, quarter: q as 1 | 2 | 3 | 4 })
  }

  for (let q = 4; q >= 1; q--) {
    quarters.push({ year: currentYear - 1, quarter: q as 1 | 2 | 3 | 4 })
  }

  return quarters
}

function generateHistoryFilterOptions(): {
  months: FilterOption[]
  quarters: FilterOption[]
} {
  const months: FilterOption[] = [
    {
      value: 'this-month',
      label: 'This Month',
      ...getThisMonthRange(),
    },
    {
      value: 'last-2-months',
      label: 'Last 2 Months',
      ...getLastNMonthsRange(2),
    },
  ]

  const availableQuarters = getAvailableQuarters()
  const quarters: FilterOption[] = availableQuarters.map((q) => ({
    value: `q${q.quarter}-${q.year}`,
    label: `Q${q.quarter} ${q.year}`,
    ...getQuarterRange(q.year, q.quarter),
  }))

  return { months, quarters }
}

export function CheckinOverview({ onDataChanged }: Props) {
  const [isPending, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<ViewMode>('today')
  const [checkins, setCheckins] = useState<CheckinRecord[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [error, setError] = useState<string | null>(null)

  const weekendDayOptions = useMemo(() => generateWeekendDayOptions(4), [])
  const historyFilterOptions = useMemo(() => generateHistoryFilterOptions(), [])
  const allHistoryOptions = useMemo(
    () => [...historyFilterOptions.months, ...historyFilterOptions.quarters],
    [historyFilterOptions]
  )

  const [selectedDay, setSelectedDay] = useState('sat-0')
  const [selectedDate, setSelectedDate] = useState(
    () => getWeekendDates(0).start
  )
  const [selectedHistoryFilter, setSelectedHistoryFilter] =
    useState('this-month')
  const [dateRange, setDateRange] = useState(() => getThisMonthRange())
  const [shiftFilter, setShiftFilter] = useState<Shift | 'all'>('all')
  const [teacherFilter, setTeacherFilter] = useState<string | 'all'>('all')

  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
  })

  useEffect(() => {
    loadTeachers()
  }, [])

  useEffect(() => {
    if (viewMode === 'today') {
      loadTodayCheckins()
    } else {
      loadHistory(1)
    }
  }, [viewMode, selectedDate, dateRange, shiftFilter, teacherFilter])

  function loadTeachers() {
    startTransition(async () => {
      const result = await getTeachersForDropdownAction()
      if (result.success && result.data) {
        setTeachers(result.data)
      }
    })
  }

  function loadTodayCheckins() {
    startTransition(async () => {
      const filters: { date?: Date; shift?: Shift; teacherId?: string } = {
        date: selectedDate,
      }
      if (shiftFilter !== 'all') {
        filters.shift = shiftFilter
      }
      if (teacherFilter !== 'all') {
        filters.teacherId = teacherFilter
      }

      const result = await getCheckinsForDateAction(filters)
      if (result.success && result.data) {
        setCheckins(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to load check-ins')
      }
    })
  }

  function loadHistory(page: number) {
    startTransition(async () => {
      const filters: {
        dateFrom?: Date
        dateTo?: Date
        shift?: Shift
        teacherId?: string
        page?: number
        limit?: number
      } = {
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        page,
        limit: 20,
      }
      if (shiftFilter !== 'all') {
        filters.shift = shiftFilter
      }
      if (teacherFilter !== 'all') {
        filters.teacherId = teacherFilter
      }

      const result = await getCheckinHistoryWithFiltersAction(filters)
      if (result.success && result.data) {
        setCheckins(result.data.data)
        setPagination({
          page: result.data.page,
          total: result.data.total,
          totalPages: result.data.totalPages,
        })
        setError(null)
      } else {
        setError(result.error || 'Failed to load check-in history')
      }
    })
  }

  function handleRefresh() {
    if (viewMode === 'today') {
      loadTodayCheckins()
    } else {
      loadHistory(pagination.page)
    }
    onDataChanged?.()
  }

  function handleCheckinUpdated() {
    handleRefresh()
  }

  function handleCheckinDeleted() {
    handleRefresh()
  }

  function handleDayChange(value: string) {
    setSelectedDay(value)
    const option = weekendDayOptions.find((o) => o.value === value)
    if (option) {
      setSelectedDate(option.date)
    }
  }

  function handleHistoryFilterChange(value: string) {
    setSelectedHistoryFilter(value)
    const option = allHistoryOptions.find((o) => o.value === value)
    if (option) {
      setDateRange({ start: option.start, end: option.end })
    }
  }

  function handleToday() {
    const { start } = getWeekendDates(0)
    const dayOfWeek = getDay(new Date())
    if (dayOfWeek === 0) {
      setSelectedDay('sun-0')
      setSelectedDate(addDays(start, 1))
    } else {
      setSelectedDay('sat-0')
      setSelectedDate(start)
    }
    setViewMode('today')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-1">
            <Button
              variant={viewMode === 'today' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('today')}
            >
              Day
            </Button>
            <Button
              variant={viewMode === 'history' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('history')}
            >
              History
            </Button>
          </div>

          {viewMode === 'today' ? (
            <>
              <Select value={selectedDay} onValueChange={handleDayChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {weekendDayOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
            </>
          ) : (
            <Select
              value={selectedHistoryFilter}
              onValueChange={handleHistoryFilterChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Months</SelectLabel>
                  {historyFilterOptions.months.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Quarters</SelectLabel>
                  {historyFilterOptions.quarters.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={shiftFilter}
            onValueChange={(value) => setShiftFilter(value as Shift | 'all')}
          >
            <SelectTrigger className="w-[130px]">
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
            onValueChange={(value) => setTeacherFilter(value)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Teacher" />
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
            onClick={handleRefresh}
            disabled={isPending}
          >
            <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {isPending && checkins.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : checkins.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No check-ins found for the selected filters
          </p>
        </div>
      ) : (
        <>
          <div className="hidden sm:block">
            <CheckinTable
              checkins={checkins}
              onUpdated={handleCheckinUpdated}
              onDeleted={handleCheckinDeleted}
            />
          </div>
          <div className="space-y-2 sm:hidden">
            {checkins.map((checkin) => (
              <CheckinCard
                key={checkin.id}
                checkin={checkin}
                onUpdated={handleCheckinUpdated}
                onDeleted={handleCheckinDeleted}
              />
            ))}
          </div>

          {viewMode === 'history' && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} (
                {pagination.total} records)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadHistory(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isPending}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadHistory(pagination.page + 1)}
                  disabled={
                    pagination.page >= pagination.totalPages || isPending
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
