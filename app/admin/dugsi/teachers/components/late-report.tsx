'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import { AlertCircle, Clock, Loader2 } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SHIFT_BADGES } from '@/lib/constants/dugsi'
import { cn } from '@/lib/utils'

import { CheckinRecord, getLateArrivalsAction } from '../actions'
import { formatCheckinDate, formatCheckinTime } from './date-utils'
import { FilterControls, HistoryFilterSelect } from './filter-controls'
import { useCheckinFilters } from './use-checkin-filters'

interface TeacherLateGroup {
  teacherId: string
  teacherName: string
  lateCount: number
  records: CheckinRecord[]
}

type ViewMode = 'grouped' | 'table'

export function LateReport() {
  const filters = useCheckinFilters()
  const [isPending, startTransition] = useTransition()
  const [records, setRecords] = useState<CheckinRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grouped')

  const groupedByTeacher = useMemo(() => {
    const groups = new Map<string, TeacherLateGroup>()

    for (const record of records) {
      const existing = groups.get(record.teacherId)
      if (existing) {
        existing.lateCount++
        existing.records.push(record)
      } else {
        groups.set(record.teacherId, {
          teacherId: record.teacherId,
          teacherName: record.teacherName,
          lateCount: 1,
          records: [record],
        })
      }
    }

    return Array.from(groups.values()).sort((a, b) => b.lateCount - a.lateCount)
  }, [records])

  const loadData = useCallback(() => {
    startTransition(async () => {
      const queryFilters: {
        dateFrom: Date
        dateTo: Date
        shift?: Shift
        teacherId?: string
      } = {
        dateFrom: filters.dateRange.start,
        dateTo: filters.dateRange.end,
      }
      if (filters.shiftFilter !== 'all') {
        queryFilters.shift = filters.shiftFilter
      }
      if (filters.teacherFilter !== 'all') {
        queryFilters.teacherId = filters.teacherFilter
      }

      const result = await getLateArrivalsAction(queryFilters)
      if (result.success && result.data) {
        setRecords(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to load late arrivals')
      }
    })
  }, [filters.dateRange, filters.shiftFilter, filters.teacherFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const isLoading = isPending || filters.isPending

  return (
    <div className="space-y-4">
      <div className="space-y-3 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-1">
            <Button
              variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grouped')}
            >
              Grouped
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              Table
            </Button>
          </div>

          <HistoryFilterSelect
            value={filters.selectedHistoryFilter}
            onChange={filters.handleHistoryFilterChange}
            options={filters.historyFilterOptions}
          />
        </div>

        <FilterControls
          shiftFilter={filters.shiftFilter}
          onShiftChange={filters.setShiftFilter}
          teacherFilter={filters.teacherFilter}
          onTeacherChange={filters.setTeacherFilter}
          teachers={filters.teachers}
          onRefresh={loadData}
          isPending={isLoading}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {isLoading && records.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">
            No late arrivals found for the selected period
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/50 p-4">
            <div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Late Arrivals
              </p>
              <p className="text-xl font-bold sm:text-2xl">{records.length}</p>
            </div>
            <div className="text-right sm:text-left">
              <p className="text-xs text-muted-foreground sm:text-sm">
                Teachers
              </p>
              <p className="text-xl font-bold sm:text-2xl">
                {groupedByTeacher.length}
              </p>
            </div>
          </div>

          {viewMode === 'grouped' ? (
            <Accordion type="multiple" className="space-y-2">
              {groupedByTeacher.map((group) => (
                <AccordionItem
                  key={group.teacherId}
                  value={group.teacherId}
                  className="rounded-lg border"
                >
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-4">
                      <span className="font-medium">{group.teacherName}</span>
                      <Badge
                        variant="secondary"
                        className="bg-orange-100 text-orange-800"
                      >
                        {group.lateCount} late{' '}
                        {group.lateCount === 1 ? 'arrival' : 'arrivals'}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {group.records.map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center gap-2 rounded-lg bg-muted/50 p-3"
                        >
                          <Badge
                            variant="outline"
                            className={cn(
                              'shrink-0 text-xs',
                              SHIFT_BADGES[record.shift].className
                            )}
                          >
                            {SHIFT_BADGES[record.shift].label}
                          </Badge>
                          <span className="text-sm">
                            {formatCheckinDate(record.date)}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">
                            {formatCheckinTime(record.clockInTime)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Teacher</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Shift</TableHead>
                    <TableHead className="whitespace-nowrap">
                      Clock In
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {record.teacherName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatCheckinDate(record.date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            SHIFT_BADGES[record.shift].className
                          )}
                        >
                          {SHIFT_BADGES[record.shift].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatCheckinTime(record.clockInTime)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
