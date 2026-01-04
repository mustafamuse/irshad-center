'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import { format } from 'date-fns'
import { Check, Clock, Minus, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  CHECKIN_STATUS_BADGES,
  SHIFT_TIME_LABELS,
} from '@/lib/constants/teacher-checkin'

import type { TeacherWithCheckinStatus } from '../_types'
import { getTodayCheckinsAction } from '../actions'

interface TodayCheckinsProps {
  initialData: TeacherWithCheckinStatus[]
}

export function TodayCheckins({ initialData }: TodayCheckinsProps) {
  const [teachers, setTeachers] = useState(initialData)
  const [shiftFilter, setShiftFilter] = useState<Shift | 'ALL'>('ALL')
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = await getTodayCheckinsAction()
      setTeachers(data)
    })
  }, [])

  useEffect(() => {
    const interval = setInterval(refresh, 60000)
    return () => clearInterval(interval)
  }, [refresh])

  const filteredTeachers = teachers.filter((t) => {
    if (shiftFilter === 'ALL') return true
    return t.shifts.includes(shiftFilter)
  })

  const getCheckinForShift = (
    teacher: TeacherWithCheckinStatus,
    shift: Shift
  ) => {
    return shift === Shift.MORNING
      ? teacher.morningCheckin
      : teacher.afternoonCheckin
  }

  const formatTime = (date: Date | null) => {
    if (!date) return null
    return format(new Date(date), 'h:mm a')
  }

  const stats = {
    total: filteredTeachers.length,
    checkedIn: filteredTeachers.filter((t) => {
      if (shiftFilter === 'ALL') {
        return t.morningCheckin || t.afternoonCheckin
      }
      return getCheckinForShift(t, shiftFilter) !== null
    }).length,
    late: filteredTeachers.filter((t) => {
      if (shiftFilter === 'ALL') {
        return t.morningCheckin?.isLate || t.afternoonCheckin?.isLate
      }
      return getCheckinForShift(t, shiftFilter)?.isLate
    }).length,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={shiftFilter}
            onValueChange={(v) => v && setShiftFilter(v as Shift | 'ALL')}
          >
            <ToggleGroupItem value="ALL" aria-label="All shifts">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value={Shift.MORNING} aria-label="Morning shift">
              Morning
            </ToggleGroupItem>
            <ToggleGroupItem
              value={Shift.AFTERNOON}
              aria-label="Afternoon shift"
            >
              Afternoon
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isPending}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Teachers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Checked In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {stats.checkedIn}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Late Arrivals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{stats.late}</p>
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teacher</TableHead>
              <TableHead>Assigned Shifts</TableHead>
              {(shiftFilter === 'ALL' || shiftFilter === Shift.MORNING) && (
                <TableHead>Morning ({SHIFT_TIME_LABELS.MORNING})</TableHead>
              )}
              {(shiftFilter === 'ALL' || shiftFilter === Shift.AFTERNOON) && (
                <TableHead>Afternoon ({SHIFT_TIME_LABELS.AFTERNOON})</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeachers.map((teacher) => (
              <TableRow key={teacher.id}>
                <TableCell className="font-medium">{teacher.name}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {teacher.shifts.map((shift) => (
                      <Badge key={shift} variant="secondary">
                        {shift}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                {(shiftFilter === 'ALL' || shiftFilter === Shift.MORNING) && (
                  <TableCell>
                    {teacher.shifts.includes(Shift.MORNING) ? (
                      teacher.morningCheckin ? (
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>
                            {formatTime(teacher.morningCheckin.clockInTime)}
                          </span>
                          {teacher.morningCheckin.isLate && (
                            <Badge
                              variant="outline"
                              className={CHECKIN_STATUS_BADGES.LATE.className}
                            >
                              Late
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Not checked in</span>
                        </div>
                      )
                    ) : (
                      <span className="text-muted-foreground">
                        <Minus className="h-4 w-4" />
                      </span>
                    )}
                  </TableCell>
                )}
                {(shiftFilter === 'ALL' || shiftFilter === Shift.AFTERNOON) && (
                  <TableCell>
                    {teacher.shifts.includes(Shift.AFTERNOON) ? (
                      teacher.afternoonCheckin ? (
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>
                            {formatTime(teacher.afternoonCheckin.clockInTime)}
                          </span>
                          {teacher.afternoonCheckin.isLate && (
                            <Badge
                              variant="outline"
                              className={CHECKIN_STATUS_BADGES.LATE.className}
                            >
                              Late
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Not checked in</span>
                        </div>
                      )
                    ) : (
                      <span className="text-muted-foreground">
                        <Minus className="h-4 w-4" />
                      </span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="block space-y-3 lg:hidden">
        {filteredTeachers.map((teacher) => (
          <Card key={teacher.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{teacher.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-1">
                {teacher.shifts.map((shift) => (
                  <Badge key={shift} variant="secondary" className="text-xs">
                    {shift}
                  </Badge>
                ))}
              </div>
              {(shiftFilter === 'ALL' || shiftFilter === Shift.MORNING) &&
                teacher.shifts.includes(Shift.MORNING) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Morning</span>
                    {teacher.morningCheckin ? (
                      <div className="flex items-center gap-2">
                        <span>
                          {formatTime(teacher.morningCheckin.clockInTime)}
                        </span>
                        {teacher.morningCheckin.isLate && (
                          <Badge
                            variant="outline"
                            className={CHECKIN_STATUS_BADGES.LATE.className}
                          >
                            Late
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        Not checked in
                      </span>
                    )}
                  </div>
                )}
              {(shiftFilter === 'ALL' || shiftFilter === Shift.AFTERNOON) &&
                teacher.shifts.includes(Shift.AFTERNOON) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Afternoon</span>
                    {teacher.afternoonCheckin ? (
                      <div className="flex items-center gap-2">
                        <span>
                          {formatTime(teacher.afternoonCheckin.clockInTime)}
                        </span>
                        {teacher.afternoonCheckin.isLate && (
                          <Badge
                            variant="outline"
                            className={CHECKIN_STATUS_BADGES.LATE.className}
                          >
                            Late
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        Not checked in
                      </span>
                    )}
                  </div>
                )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
