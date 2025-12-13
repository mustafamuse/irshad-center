'use client'

import { useState, useEffect, useTransition } from 'react'

import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import {
  CalendarIcon,
  Loader2,
  TrendingUp,
  BookOpen,
  Users,
  Calendar,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
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
import type { DugsiClassDTO } from '@/lib/types/dugsi-attendance'
import { cn } from '@/lib/utils'

import { getAllClassesStatsAction } from '../actions'
import { ClassReportCard } from './class-report-card'

interface ReportsDashboardProps {
  classes: DugsiClassDTO[]
}

type DatePreset = 'today' | 'week' | 'month' | 'custom'

export function ReportsDashboard({ classes }: ReportsDashboardProps) {
  const [isPending, startTransition] = useTransition()
  const [datePreset, setDatePreset] = useState<DatePreset>('month')
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()))
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()))
  const [classStats, setClassStats] = useState<
    Array<{
      classId: string
      className: string
      totalSessions: number
      averageAttendanceRate: number
      averageLessonCompletionRate: number
    }>
  >([])

  useEffect(() => {
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  useEffect(() => {
    const now = new Date()
    switch (datePreset) {
      case 'today':
        setStartDate(now)
        setEndDate(now)
        break
      case 'week':
        setStartDate(subDays(now, 7))
        setEndDate(now)
        break
      case 'month':
        setStartDate(startOfMonth(now))
        setEndDate(endOfMonth(now))
        break
    }
  }, [datePreset])

  const loadStats = async () => {
    if (classes.length === 0) return

    startTransition(async () => {
      const result = await getAllClassesStatsAction(
        classes.map((c) => c.id),
        { startDate, endDate }
      )

      if (result.success && result.data) {
        setClassStats(result.data)
      }
    })
  }

  const overallStats = {
    totalSessions: classStats.reduce((sum, s) => sum + s.totalSessions, 0),
    avgAttendance:
      classStats.length > 0
        ? Math.round(
            classStats.reduce((sum, s) => sum + s.averageAttendanceRate, 0) /
              classStats.length
          )
        : 0,
    avgLessonCompletion:
      classStats.length > 0
        ? Math.round(
            classStats.reduce(
              (sum, s) => sum + s.averageLessonCompletionRate,
              0
            ) / classStats.length
          )
        : 0,
    totalClasses: classes.length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Attendance Reports
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            View attendance statistics and trends
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Select
          value={datePreset}
          onValueChange={(v) => setDatePreset(v as DatePreset)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>

        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[140px] justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'MMM d, yyyy') : 'Start'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => d && setStartDate(d)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[140px] justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'MMM d, yyyy') : 'End'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => d && setEndDate(d)}
                  disabled={(date) => date > new Date() || date < startDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
        </div>
      </div>

      {isPending ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Sessions
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overallStats.totalSessions}
                </div>
                <p className="text-xs text-muted-foreground">
                  across all classes
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Attendance
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overallStats.avgAttendance}%
                </div>
                <p className="text-xs text-muted-foreground">present rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Lesson Completion
                </CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overallStats.avgLessonCompletion}%
                </div>
                <p className="text-xs text-muted-foreground">completion rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Classes
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overallStats.totalClasses}
                </div>
                <p className="text-xs text-muted-foreground">Dugsi classes</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Class Breakdown</h2>
            {classStats.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  No data for selected period
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {classStats.map((stats) => (
                  <ClassReportCard key={stats.classId} stats={stats} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
