'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import { format, subDays } from 'date-fns'
import { CalendarIcon, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import type {
  LateByDate,
  LateByTeacher,
  LateReportViewMode,
  TeacherCheckinWithRelations,
} from '../_types'
import { getLateArrivalsAction, getTeachersForFilterAction } from '../actions'

export function LateReport() {
  const [lateCheckins, setLateCheckins] = useState<
    TeacherCheckinWithRelations[]
  >([])
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string }>>(
    []
  )
  const [viewMode, setViewMode] = useState<LateReportViewMode>('by-teacher')

  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30))
  const [dateTo, setDateTo] = useState<Date>(new Date())
  const [shiftFilter, setShiftFilter] = useState<Shift | 'ALL'>('ALL')
  const [teacherFilter, setTeacherFilter] = useState<string>('ALL')

  const [isPending, startTransition] = useTransition()

  const loadData = useCallback(() => {
    startTransition(async () => {
      const result = await getLateArrivalsAction(
        dateFrom.toISOString(),
        dateTo.toISOString(),
        shiftFilter === 'ALL' ? undefined : shiftFilter,
        teacherFilter === 'ALL' ? undefined : teacherFilter
      )
      setLateCheckins(result)
    })
  }, [dateFrom, dateTo, shiftFilter, teacherFilter])

  useEffect(() => {
    const loadTeachers = async () => {
      const data = await getTeachersForFilterAction()
      setTeachers(data)
    }
    loadTeachers()
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const groupByTeacher = (): LateByTeacher[] => {
    const map = new Map<string, LateByTeacher>()
    lateCheckins.forEach((c) => {
      const existing = map.get(c.teacherId)
      if (existing) {
        existing.lateCount++
        existing.checkins.push(c)
      } else {
        map.set(c.teacherId, {
          teacherId: c.teacherId,
          teacherName: c.teacher.person.name,
          lateCount: 1,
          checkins: [c],
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => b.lateCount - a.lateCount)
  }

  const groupByDate = (): LateByDate[] => {
    const map = new Map<string, LateByDate>()
    lateCheckins.forEach((c) => {
      const dateKey = format(new Date(c.date), 'yyyy-MM-dd')
      const existing = map.get(dateKey)
      if (existing) {
        existing.lateCount++
        existing.checkins.push(c)
      } else {
        map.set(dateKey, {
          date: dateKey,
          lateCount: 1,
          checkins: [c],
        })
      }
    })
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  const byTeacher = groupByTeacher()
  const byDate = groupByDate()

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

        <Button onClick={loadData} disabled={isPending}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Late Arrivals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {lateCheckins.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Teachers with Late Arrivals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{byTeacher.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={viewMode}
        onValueChange={(v) => setViewMode(v as LateReportViewMode)}
      >
        <TabsList>
          <TabsTrigger value="by-teacher">By Teacher</TabsTrigger>
          <TabsTrigger value="by-date">By Date</TabsTrigger>
        </TabsList>

        <TabsContent value="by-teacher" className="mt-4">
          {byTeacher.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No late arrivals found
            </p>
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Late Count</TableHead>
                      <TableHead>Recent Dates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byTeacher.map((item) => (
                      <TableRow key={item.teacherId}>
                        <TableCell className="font-medium">
                          {item.teacherName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-orange-100 text-orange-800"
                          >
                            {item.lateCount} late
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.checkins
                            .slice(0, 3)
                            .map((c) => format(new Date(c.date), 'MMM d'))
                            .join(', ')}
                          {item.checkins.length > 3 && '...'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="block space-y-3 lg:hidden">
                {byTeacher.map((item) => (
                  <Card key={item.teacherId}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {item.teacherName}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="bg-orange-100 text-orange-800"
                        >
                          {item.lateCount} late
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {item.checkins
                          .slice(0, 3)
                          .map((c) => format(new Date(c.date), 'MMM d'))
                          .join(', ')}
                        {item.checkins.length > 3 && '...'}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="by-date" className="mt-4">
          {byDate.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No late arrivals found
            </p>
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Late Count</TableHead>
                      <TableHead>Teachers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byDate.map((item) => (
                      <TableRow key={item.date}>
                        <TableCell className="font-medium">
                          {format(new Date(item.date), 'EEEE, MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-orange-100 text-orange-800"
                          >
                            {item.lateCount} late
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.checkins
                            .map((c) => c.teacher.person.name)
                            .join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="block space-y-3 lg:hidden">
                {byDate.map((item) => (
                  <Card key={item.date}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {format(new Date(item.date), 'EEE, MMM d')}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="bg-orange-100 text-orange-800"
                        >
                          {item.lateCount} late
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {item.checkins
                          .map((c) => c.teacher.person.name)
                          .join(', ')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
