'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
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

function formatTime(date: Date): string {
  return format(new Date(date), 'h:mm a')
}

function formatDate(date: Date): string {
  return format(new Date(date), 'EEE, MMM d')
}

export function LateReport() {
  const [isPending, startTransition] = useTransition()
  const [records, setRecords] = useState<CheckinRecord[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [error, setError] = useState<string | null>(null)

  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
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
    const toDate = dateRange.to
    if (!toDate) return
    startTransition(async () => {
      const filters: {
        dateFrom: Date
        dateTo: Date
        shift?: Shift
        teacherId?: string
      } = {
        dateFrom: startOfDay(dateRange.from),
        dateTo: endOfDay(toDate),
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

  function handleThisWeek() {
    setDateRange({
      from: subDays(new Date(), 7),
      to: new Date(),
    })
  }

  function handleThisMonth() {
    setDateRange({
      from: subDays(new Date(), 30),
      to: new Date(),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(dateRange.from, 'MMM d')}
                {dateRange.to && ` - ${format(dateRange.to, 'MMM d')}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(selected) => {
                  if (selected?.from) {
                    setDateRange({
                      from: selected.from,
                      to: selected.to,
                    })
                  }
                }}
                initialFocus
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={handleThisWeek}>
            This Week
          </Button>
          <Button variant="outline" size="sm" onClick={handleThisMonth}>
            This Month
          </Button>
        </div>

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
