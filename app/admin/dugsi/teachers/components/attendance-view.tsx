'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'

import { Shift } from '@prisma/client'
import { format } from 'date-fns'
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import {
  AttendanceGridData,
  TeacherCheckinStatusForClient,
  TeacherOption,
  getAttendanceGridAction,
  getTeachersWithCheckinStatusAction,
} from '../actions'
import { AttendanceGrid } from './attendance-grid'
import { CheckinSplitView } from './checkin-split-view'
import { generateWeekendDayOptions, getWeekendDates } from './date-utils'
import { FilterControls } from './filter-controls'
import { useCheckinFilters } from './use-checkin-filters'

interface Props {
  onDataChanged?: () => void
  initialCheckinStatuses?: TeacherCheckinStatusForClient[]
  initialTeacherOptions?: TeacherOption[]
}

type ViewMode = 'day' | 'grid'

export function AttendanceView({
  onDataChanged,
  initialCheckinStatuses,
  initialTeacherOptions,
}: Props) {
  const filters = useCheckinFilters(initialTeacherOptions)
  const [isPending, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [teacherStatuses, setTeacherStatuses] = useState<
    TeacherCheckinStatusForClient[]
  >(initialCheckinStatuses ?? [])
  const [gridData, setGridData] = useState<AttendanceGridData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const navigableDates = useMemo(() => {
    const opts = generateWeekendDayOptions(4)
    return opts
      .filter((o) => o.value !== 'this-weekend')
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [])

  const [dateIndex, setDateIndex] = useState(0)
  const selectedDate = useMemo(
    () => navigableDates[dateIndex]?.date ?? getWeekendDates(0).start,
    [navigableDates, dateIndex]
  )

  const activeShift: Shift | null =
    filters.shiftFilter !== 'all' ? filters.shiftFilter : null
  const activeTeacherFilter =
    filters.teacherFilter !== 'all' ? filters.teacherFilter : undefined

  const loadDayView = useCallback(() => {
    startTransition(async () => {
      const result = await getTeachersWithCheckinStatusAction(selectedDate)
      if (result.success && result.data) {
        setTeacherStatuses(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to load teacher status')
      }
    })
  }, [selectedDate])

  const loadGridView = useCallback(() => {
    startTransition(async () => {
      const result = await getAttendanceGridAction(8)
      if (result.success && result.data) {
        setGridData(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to load attendance grid')
      }
    })
  }, [])

  const isInitialMount = useRef(true)

  useEffect(() => {
    if (
      isInitialMount.current &&
      initialCheckinStatuses &&
      initialCheckinStatuses.length > 0 &&
      viewMode === 'day'
    ) {
      isInitialMount.current = false
      return
    }
    isInitialMount.current = false
    if (viewMode === 'day') {
      loadDayView()
    } else {
      loadGridView()
    }
  }, [viewMode, loadDayView, loadGridView, initialCheckinStatuses])

  function handleRefresh() {
    if (viewMode === 'day') {
      loadDayView()
    } else {
      loadGridView()
    }
    onDataChanged?.()
  }

  function handlePrevDay() {
    setDateIndex((i) => Math.min(i + 1, navigableDates.length - 1))
  }

  function handleNextDay() {
    setDateIndex((i) => Math.max(i - 1, 0))
  }

  const isLoading = isPending || filters.isPending
  const hasData =
    viewMode === 'day' ? teacherStatuses.length > 0 : gridData !== null

  return (
    <div className="space-y-4">
      <div className="space-y-3 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-1">
            <Button
              variant={viewMode === 'day' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('day')}
            >
              Day
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              Grid
            </Button>
          </div>

          {viewMode === 'day' && (
            <div
              role="group"
              aria-label="Date navigation"
              className="flex items-center gap-1"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handlePrevDay}
                disabled={dateIndex >= navigableDates.length - 1}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span
                aria-live="polite"
                className="min-w-[120px] text-center text-sm font-medium"
              >
                {format(selectedDate, 'EEE, MMM d')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNextDay}
                disabled={dateIndex <= 0}
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <FilterControls
          shiftFilter={filters.shiftFilter}
          onShiftChange={filters.setShiftFilter}
          teacherFilter={filters.teacherFilter}
          onTeacherChange={filters.setTeacherFilter}
          teachers={filters.teachers}
          teachersError={filters.teachersError}
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

      {isLoading && !hasData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === 'day' ? (
        <CheckinSplitView
          teachers={teacherStatuses}
          shift={activeShift}
          date={selectedDate}
          onRefresh={handleRefresh}
          teacherFilter={activeTeacherFilter}
        />
      ) : gridData ? (
        <AttendanceGrid
          data={gridData}
          shiftFilter={filters.shiftFilter}
          teacherFilter={activeTeacherFilter}
        />
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No attendance data available</p>
        </div>
      )}
    </div>
  )
}
