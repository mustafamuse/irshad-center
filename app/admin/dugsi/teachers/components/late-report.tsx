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
} from 'date-fns'
import { AlertCircle, Clock, Loader2, RefreshCw } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
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
import { SHIFT_BADGES } from '@/lib/constants/dugsi'
import { cn } from '@/lib/utils'

import {
  CheckinRecord,
  TeacherOption,
  getLateArrivalsAction,
  getTeachersForDropdownAction,
} from '../actions'

interface TeacherLateGroup {
  teacherId: string
  teacherName: string
  lateCount: number
  records: CheckinRecord[]
}

interface FilterOption {
  value: string
  label: string
  start: Date
  end: Date
}

function formatTime(date: Date): string {
  return format(new Date(date), 'h:mm a')
}

function formatDate(date: Date): string {
  return format(new Date(date), 'EEE, MMM d')
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

function generateFilterOptions(): {
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

export function LateReport() {
  const [isPending, startTransition] = useTransition()
  const [records, setRecords] = useState<CheckinRecord[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [error, setError] = useState<string | null>(null)

  const filterOptions = useMemo(() => generateFilterOptions(), [])
  const allOptions = useMemo(
    () => [...filterOptions.months, ...filterOptions.quarters],
    [filterOptions]
  )

  const [selectedFilter, setSelectedFilter] = useState('this-month')
  const [dateRange, setDateRange] = useState(() => getThisMonthRange())
  const [shiftFilter, setShiftFilter] = useState<Shift | 'all'>('all')
  const [teacherFilter, setTeacherFilter] = useState<string | 'all'>('all')

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

  useEffect(() => {
    loadTeachers()
  }, [])

  useEffect(() => {
    loadData()
  }, [dateRange, shiftFilter, teacherFilter])

  function loadTeachers() {
    startTransition(async () => {
      const result = await getTeachersForDropdownAction()
      if (result.success && result.data) {
        setTeachers(result.data)
      }
    })
  }

  function loadData() {
    startTransition(async () => {
      const filters: {
        dateFrom: Date
        dateTo: Date
        shift?: Shift
        teacherId?: string
      } = {
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
      }
      if (shiftFilter !== 'all') {
        filters.shift = shiftFilter
      }
      if (teacherFilter !== 'all') {
        filters.teacherId = teacherFilter
      }

      const result = await getLateArrivalsAction(filters)
      if (result.success && result.data) {
        setRecords(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to load late arrivals')
      }
    })
  }

  function handleFilterChange(value: string) {
    setSelectedFilter(value)
    const option = allOptions.find((o) => o.value === value)
    if (option) {
      setDateRange({ start: option.start, end: option.end })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Select value={selectedFilter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Months</SelectLabel>
              {filterOptions.months.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Quarters</SelectLabel>
              {filterOptions.quarters.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="flex flex-1 items-center justify-end gap-2">
          <Select
            value={shiftFilter}
            onValueChange={(value) => setShiftFilter(value as Shift | 'all')}
          >
            <SelectTrigger className="w-[100px]">
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
            <SelectTrigger className="min-w-[140px]">
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
            className="shrink-0"
            onClick={loadData}
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

      {isPending && records.length === 0 ? (
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
                          {formatDate(record.date)}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          {formatTime(record.clockInTime)}
                        </span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  )
}
