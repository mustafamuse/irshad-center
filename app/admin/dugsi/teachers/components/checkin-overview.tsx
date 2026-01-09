'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import { AlertCircle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  CheckinRecord,
  getCheckinsForDateAction,
  getCheckinHistoryWithFiltersAction,
} from '../actions'
import { CheckinCard } from './checkin-card'
import { CheckinTable } from './checkin-table'
import { generateWeekendDayOptions, getWeekendDates } from './date-utils'
import { FilterControls, HistoryFilterSelect } from './filter-controls'
import { useCheckinFilters } from './use-checkin-filters'

interface Props {
  onDataChanged?: () => void
}

type ViewMode = 'today' | 'history'

export function CheckinOverview({ onDataChanged }: Props) {
  const filters = useCheckinFilters()
  const [isPending, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<ViewMode>('today')
  const [checkins, setCheckins] = useState<CheckinRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  const weekendDayOptions = useMemo(() => generateWeekendDayOptions(4), [])

  const [selectedDay, setSelectedDay] = useState('this-weekend')
  const [selectedDate, setSelectedDate] = useState(
    () => getWeekendDates(0).start
  )
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(
    () => getWeekendDates(0).end
  )

  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
  })

  const loadTodayCheckins = useCallback(() => {
    startTransition(async () => {
      const queryFilters: {
        date?: Date
        dateTo?: Date
        shift?: Shift
        teacherId?: string
      } = {
        date: selectedDate,
      }
      if (selectedEndDate) {
        queryFilters.dateTo = selectedEndDate
      }
      if (filters.shiftFilter !== 'all') {
        queryFilters.shift = filters.shiftFilter
      }
      if (filters.teacherFilter !== 'all') {
        queryFilters.teacherId = filters.teacherFilter
      }

      const result = await getCheckinsForDateAction(queryFilters)
      if (result.success && result.data) {
        setCheckins(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to load check-ins')
      }
    })
  }, [
    selectedDate,
    selectedEndDate,
    filters.shiftFilter,
    filters.teacherFilter,
  ])

  const loadHistory = useCallback(
    (page: number) => {
      startTransition(async () => {
        const queryFilters: {
          dateFrom?: Date
          dateTo?: Date
          shift?: Shift
          teacherId?: string
          page?: number
          limit?: number
        } = {
          dateFrom: filters.dateRange.start,
          dateTo: filters.dateRange.end,
          page,
          limit: 20,
        }
        if (filters.shiftFilter !== 'all') {
          queryFilters.shift = filters.shiftFilter
        }
        if (filters.teacherFilter !== 'all') {
          queryFilters.teacherId = filters.teacherFilter
        }

        const result = await getCheckinHistoryWithFiltersAction(queryFilters)
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
    },
    [filters.dateRange, filters.shiftFilter, filters.teacherFilter]
  )

  useEffect(() => {
    if (viewMode === 'today') {
      loadTodayCheckins()
    } else {
      loadHistory(1)
    }
  }, [viewMode, loadTodayCheckins, loadHistory])

  function handleRefresh() {
    if (viewMode === 'today') {
      loadTodayCheckins()
    } else {
      loadHistory(pagination.page)
    }
    onDataChanged?.()
  }

  function handleDayChange(value: string) {
    setSelectedDay(value)
    const option = weekendDayOptions.find((o) => o.value === value)
    if (option) {
      setSelectedDate(option.date)
      setSelectedEndDate(option.endDate)
    }
  }

  const isLoading = isPending || filters.isPending

  return (
    <div className="space-y-4">
      <div className="space-y-3 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
        <div className="flex items-center gap-2">
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
            <Select value={selectedDay} onValueChange={handleDayChange}>
              <SelectTrigger className="flex-1 sm:w-[200px]">
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
          ) : (
            <HistoryFilterSelect
              value={filters.selectedHistoryFilter}
              onChange={filters.handleHistoryFilterChange}
              options={filters.historyFilterOptions}
            />
          )}
        </div>

        <FilterControls
          shiftFilter={filters.shiftFilter}
          onShiftChange={filters.setShiftFilter}
          teacherFilter={filters.teacherFilter}
          onTeacherChange={filters.setTeacherFilter}
          teachers={filters.teachers}
          onRefresh={handleRefresh}
          isPending={isLoading}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {isLoading && checkins.length === 0 ? (
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
              onUpdated={handleRefresh}
              onDeleted={handleRefresh}
            />
          </div>
          <div className="space-y-2 sm:hidden">
            {checkins.map((checkin) => (
              <CheckinCard
                key={checkin.id}
                checkin={checkin}
                onUpdated={handleRefresh}
                onDeleted={handleRefresh}
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
                  disabled={pagination.page <= 1 || isLoading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadHistory(pagination.page + 1)}
                  disabled={
                    pagination.page >= pagination.totalPages || isLoading
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
