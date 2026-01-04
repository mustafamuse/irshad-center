'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import { format, subDays } from 'date-fns'
import { CalendarIcon, ChevronLeft, ChevronRight, Search } from 'lucide-react'

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

import type { PaginationState, TeacherCheckinWithRelations } from '../_types'
import { getCheckinHistoryAction, getTeachersForFilterAction } from '../actions'
import { CheckinCard } from './checkin-card'
import { CheckinTable } from './checkin-table'

interface CheckinHistoryProps {
  onEdit?: (checkin: TeacherCheckinWithRelations) => void
  onDelete?: (checkin: TeacherCheckinWithRelations) => void
}

export function CheckinHistory({ onEdit, onDelete }: CheckinHistoryProps) {
  const [checkins, setCheckins] = useState<TeacherCheckinWithRelations[]>([])
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string }>>(
    []
  )
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 7))
  const [dateTo, setDateTo] = useState<Date>(new Date())
  const [shiftFilter, setShiftFilter] = useState<Shift | 'ALL'>('ALL')
  const [teacherFilter, setTeacherFilter] = useState<string>('ALL')

  const [isPending, startTransition] = useTransition()

  const loadData = useCallback(
    (page: number = 1) => {
      startTransition(async () => {
        const result = await getCheckinHistoryAction(
          {
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString(),
            shift: shiftFilter === 'ALL' ? undefined : shiftFilter,
            teacherId: teacherFilter === 'ALL' ? undefined : teacherFilter,
          },
          { page, limit: pagination.limit }
        )
        setCheckins(result.data)
        setPagination({
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        })
      })
    },
    [dateFrom, dateTo, shiftFilter, teacherFilter, pagination.limit]
  )

  useEffect(() => {
    const loadTeachers = async () => {
      const data = await getTeachersForFilterAction()
      setTeachers(data)
    }
    loadTeachers()
  }, [])

  useEffect(() => {
    loadData(1)
  }, [loadData])

  const handleSearch = () => {
    loadData(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium">From</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal sm:w-[200px]',
                  !dateFrom && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, 'PPP') : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => d && setDateFrom(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">To</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal sm:w-[200px]',
                  !dateTo && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, 'PPP') : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => d && setDateTo(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Shift</label>
          <Select
            value={shiftFilter}
            onValueChange={(v) => setShiftFilter(v as Shift | 'ALL')}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="All shifts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Shifts</SelectItem>
              <SelectItem value={Shift.MORNING}>Morning</SelectItem>
              <SelectItem value={Shift.AFTERNOON}>Afternoon</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Teacher</label>
          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All teachers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Teachers</SelectItem>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSearch} disabled={isPending}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {checkins.length} of {pagination.total} records
      </div>

      <CheckinTable
        checkins={checkins}
        onEdit={onEdit}
        onDelete={onDelete}
        showDate
      />

      <div className="block space-y-3 lg:hidden">
        {checkins.map((checkin) => (
          <CheckinCard
            key={checkin.id}
            checkin={checkin}
            onEdit={onEdit}
            onDelete={onDelete}
            showDate
          />
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => loadData(pagination.page - 1)}
            disabled={pagination.page === 1 || isPending}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => loadData(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages || isPending}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
