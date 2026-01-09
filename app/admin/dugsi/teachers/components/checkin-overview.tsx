'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  addDays,
  getDay,
} from 'date-fns'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
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

interface WeekendRangeOption {
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

function getLastNWeekends(n: number): { start: Date; end: Date } {
  const oldest = getWeekendDates(n - 1)
  const newest = getWeekendDates(0)
  return {
    start: oldest.start,
    end: newest.end,
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

function generateWeekendRangeOptions(count: number): WeekendRangeOption[] {
  const options: WeekendRangeOption[] = []
  for (let i = 0; i < count; i++) {
    const { start, end } = getWeekendDates(i)
    const label =
      i === 0
        ? `This Weekend (${format(start, 'MMM d')}-${format(end, 'd')})`
        : i === 1
          ? `Last Weekend (${format(start, 'MMM d')}-${format(end, 'd')})`
          : `${format(start, 'MMM d')}-${format(end, 'd')}`
    options.push({ value: i.toString(), label, start, end })
  }
  return options
}

export function CheckinOverview({ onDataChanged }: Props) {
  const [isPending, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<ViewMode>('today')
  const [checkins, setCheckins] = useState<CheckinRecord[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [error, setError] = useState<string | null>(null)

  const weekendDayOptions = useMemo(() => generateWeekendDayOptions(4), [])
  const weekendRangeOptions = useMemo(() => generateWeekendRangeOptions(8), [])

  const [selectedDay, setSelectedDay] = useState('sat-0')
  const [selectedDate, setSelectedDate] = useState(
    () => getWeekendDates(0).start
  )
  const [selectedWeekend, setSelectedWeekend] = useState('0')
  const [dateRange, setDateRange] = useState(() => getWeekendDates(0))
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

  function handleWeekendChange(value: string) {
    setSelectedWeekend(value)
    const weeksAgo = parseInt(value, 10)
    setDateRange(getWeekendDates(weeksAgo))
  }

  function handleLastN(n: number) {
    setSelectedWeekend('custom')
    setDateRange(getLastNWeekends(n))
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
            <>
              <Select
                value={selectedWeekend}
                onValueChange={handleWeekendChange}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select weekend" />
                </SelectTrigger>
                <SelectContent>
                  {weekendRangeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLastN(4)}
              >
                Last 4
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLastN(8)}
              >
                Last 8
              </Button>
            </>
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
