'use client'

import { Shift } from '@prisma/client'
import { format } from 'date-fns'
import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAdminGridQuery } from '@/lib/features/attendance/hooks/admin'
import { useAdminAttendanceController } from '@/lib/features/attendance/hooks/admin-controller'

import { CheckinCard } from './checkin-card'
import { CheckinTable } from './checkin-table'
import { FilterControls, HistoryFilterSelect } from './filter-controls'
import { useCheckinFilters } from './use-checkin-filters'

interface Props {
  onDataChanged?: () => void
}

function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function CheckinOverview({ onDataChanged }: Props) {
  const ctrl = useAdminAttendanceController()
  const filters = useCheckinFilters()

  const gridFilters =
    ctrl.viewMode === 'today'
      ? {
          date: toIsoDate(ctrl.selectedDate),
          dateTo: ctrl.selectedEndDate
            ? toIsoDate(ctrl.selectedEndDate)
            : undefined,
          shift:
            filters.shiftFilter !== 'all'
              ? (filters.shiftFilter as Shift)
              : undefined,
          teacherId:
            filters.teacherFilter !== 'all' ? filters.teacherFilter : undefined,
        }
      : {
          dateFrom: toIsoDate(ctrl.dateRange.start),
          dateTo: toIsoDate(ctrl.dateRange.end),
          shift:
            filters.shiftFilter !== 'all'
              ? (filters.shiftFilter as Shift)
              : undefined,
          teacherId:
            filters.teacherFilter !== 'all' ? filters.teacherFilter : undefined,
          page: ctrl.historyPage,
          pageSize: 20,
        }

  const gridQuery = useAdminGridQuery(gridFilters)

  const checkins = gridQuery.data?.data ?? []
  const pagination = gridQuery.data
    ? {
        page: gridQuery.data.page,
        total: gridQuery.data.total,
        totalPages: gridQuery.data.totalPages,
      }
    : null

  const isLoading =
    gridQuery.isLoading || gridQuery.isFetching || filters.isLoading
  const error = gridQuery.error?.message ?? null

  function handleRefresh() {
    void gridQuery.refetch()
    onDataChanged?.()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-1">
            <Button
              variant={ctrl.viewMode === 'today' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => ctrl.setViewMode('today')}
            >
              Day
            </Button>
            <Button
              variant={ctrl.viewMode === 'history' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => ctrl.setViewMode('history')}
            >
              History
            </Button>
          </div>

          {ctrl.viewMode === 'today' ? (
            <Select
              value={ctrl.selectedDay}
              onValueChange={ctrl.handleDayChange}
            >
              <SelectTrigger className="flex-1 sm:w-[200px]">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {ctrl.weekendDayOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <HistoryFilterSelect
              value={ctrl.selectedHistoryFilter}
              onChange={ctrl.handleHistoryFilterChange}
              options={ctrl.historyFilterOptions}
            />
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

      {isLoading && checkins.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
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

          {ctrl.viewMode === 'history' &&
            pagination &&
            pagination.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} (
                  {pagination.total} records)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => ctrl.setHistoryPage(ctrl.historyPage - 1)}
                    disabled={ctrl.historyPage <= 1 || isLoading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => ctrl.setHistoryPage(ctrl.historyPage + 1)}
                    disabled={
                      ctrl.historyPage >= pagination.totalPages || isLoading
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
