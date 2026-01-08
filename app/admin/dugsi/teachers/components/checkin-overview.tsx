'use client'

import { useEffect, useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Loader2,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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

export function CheckinOverview({ onDataChanged }: Props) {
  const [isPending, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<ViewMode>('today')
  const [checkins, setCheckins] = useState<CheckinRecord[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [error, setError] = useState<string | null>(null)

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  })
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
        dateFrom: startOfDay(dateRange.from),
        dateTo: endOfDay(dateRange.to),
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

  function handleToday() {
    setSelectedDate(new Date())
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
              Today
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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(dateRange.from, 'MMM d')} -{' '}
                  {format(dateRange.to, 'MMM d')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from) {
                      setDateRange({
                        from: range.from,
                        to: range.to || range.from,
                      })
                    }
                  }}
                  initialFocus
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}

          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
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
