'use client'

import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'

import { format } from 'date-fns'
import { Calendar as CalendarIcon, ChevronDown, Loader2 } from 'lucide-react'
import { DateRange } from 'react-day-picker'

import { useBatches, useBatchStore } from '@/app/batches/_store/batch.store'
import type { ErrorState, LoadingState } from '@/app/batches/_types'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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

interface AttendanceRecord {
  id: string
  studentName: string
  studentEmail: string
  status: string
}

interface AttendanceSession {
  id: string
  date: string
  batchName: string
  summary: {
    total: number
    present: number
    absent: number
    late: number
    excused: number
  }
  records: AttendanceRecord[]
}

export default function AttendanceHistory(): ReactElement {
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set()
  )

  const batches = useBatches()
  const batchesLoading = useBatchStore(
    (state: { batchesLoading: LoadingState }) => state.batchesLoading
  )
  const batchesError = useBatchStore(
    (state: { batchesError: ErrorState }) => state.batchesError
  )

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedSessions(newExpanded)
  }

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedBatchId && selectedBatchId !== 'all') {
        params.append('batchId', selectedBatchId)
      }
      if (dateRange?.from) {
        params.append('startDate', dateRange.from.toISOString())
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to.toISOString())
      }

      const response = await fetch(
        '/api/admin/attendance/history?' + params.toString()
      )
      const data = await response.json()
      if (data.success) {
        setSessions(data.data)
      }
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [selectedBatchId, dateRange])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Attendance History
            </h2>
            <p className="mt-2 text-muted-foreground">
              View and manage past attendance records
            </p>
          </div>
        </div>

        {!loading && sessions.length > 0 && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sessions.length}</div>
                <p className="text-xs text-muted-foreground">
                  {dateRange?.from && dateRange?.to
                    ? `From ${format(dateRange.from, 'LLL dd')} to ${format(dateRange.to, 'LLL dd')}`
                    : 'All time'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Average Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(
                    sessions.reduce(
                      (acc, session) =>
                        acc +
                        (session.summary.present / session.summary.total) * 100,
                      0
                    ) / sessions.length || 0
                  )}
                  %
                </div>
                <p className="text-xs text-muted-foreground">
                  Present students across all sessions
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Perfect Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {
                    sessions.filter(
                      (session) =>
                        session.summary.present === session.summary.total
                    ).length
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Sessions with 100% attendance
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Latest Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sessions[0]
                    ? format(new Date(sessions[0].date), 'LLL dd')
                    : '-'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {sessions[0]
                    ? `${sessions[0].summary.present} of ${sessions[0].summary.total} present`
                    : 'No sessions recorded'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="w-full md:w-auto">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger
                className="min-w-[200px]"
                disabled={batchesLoading.isLoading}
              >
                <SelectValue
                  placeholder={
                    batchesLoading.isLoading ? 'Loading...' : 'All Batches'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {batchesLoading.isLoading ? (
                  <SelectItem value="loading" disabled>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading batches...
                    </div>
                  </SelectItem>
                ) : batchesError.hasError ? (
                  <SelectItem value="error" disabled>
                    Failed to load batches
                  </SelectItem>
                ) : (
                  <>
                    <SelectItem value="all">All Batches</SelectItem>
                    {batches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date()
                    const weekStart = new Date(today)
                    weekStart.setDate(today.getDate() - today.getDay())
                    setDateRange({
                      from: weekStart,
                      to: today,
                    })
                  }}
                >
                  This Week
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date()
                    const monthStart = new Date(
                      today.getFullYear(),
                      today.getMonth(),
                      1
                    )
                    setDateRange({
                      from: monthStart,
                      to: today,
                    })
                  }}
                >
                  This Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange(undefined)}
                >
                  Clear
                </Button>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'min-w-[240px] justify-start text-left font-normal',
                      !dateRange && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'LLL dd, y')} -{' '}
                          {format(dateRange.to, 'LLL dd, y')}
                        </>
                      ) : (
                        format(dateRange.from, 'LLL dd, y')
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="flex h-32 items-center justify-center">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-muted-foreground">
                  Loading attendance records...
                </p>
              </div>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">
                No attendance records found
              </p>
            </CardContent>
          </Card>
        ) : (
          sessions.map((session) => (
            <Collapsible
              key={session.id}
              open={expandedSessions.has(session.id)}
              onOpenChange={() => toggleSession(session.id)}
            >
              <Card>
                <CardHeader className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">
                        {format(new Date(session.date), 'PPPP')}
                      </CardTitle>
                      <CardDescription className="text-base">
                        {session.batchName}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-end gap-1.5">
                          <div className="text-lg font-medium">
                            {session.summary.present} Present
                          </div>
                          <div className="text-sm text-muted-foreground">
                            of {session.summary.total}
                          </div>
                        </div>
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-green-500/80 transition-all duration-500"
                            style={{
                              width: `${(session.summary.present / session.summary.total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                          <ChevronDown
                            className={cn(
                              'h-5 w-5 transition-transform duration-200',
                              expandedSessions.has(session.id) && 'rotate-180'
                            )}
                          />
                          <span className="sr-only">Toggle details</span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-6 pb-6">
                    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                      <Card className="border-2 border-green-100 bg-green-50/50">
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-green-600">
                            Present
                          </div>
                          <div className="text-2xl font-bold text-green-700">
                            {session.summary.present}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-2 border-red-100 bg-red-50/50">
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-red-600">
                            Absent
                          </div>
                          <div className="text-2xl font-bold text-red-700">
                            {session.summary.absent}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-2 border-yellow-100 bg-yellow-50/50">
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-yellow-600">
                            Late
                          </div>
                          <div className="text-2xl font-bold text-yellow-700">
                            {session.summary.late}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-2 border-blue-100 bg-blue-50/50">
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-blue-600">
                            Excused
                          </div>
                          <div className="text-2xl font-bold text-blue-700">
                            {session.summary.excused}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="rounded-lg border shadow-sm">
                      <div className="flex items-center justify-between border-b bg-muted/50 px-6 py-4">
                        <div className="font-medium">Student</div>
                        <div className="font-medium">Status</div>
                      </div>
                      <div className="divide-y">
                        {session.records.map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between px-6 py-4 hover:bg-muted/50"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <div className="truncate">
                                  <div className="font-medium">
                                    {record.studentName}
                                  </div>
                                  <div className="truncate text-sm text-muted-foreground">
                                    {record.studentEmail}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="ml-4 flex-shrink-0">
                              <div
                                className={cn(
                                  'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset',
                                  {
                                    'bg-green-50 text-green-700 ring-green-600/20':
                                      record.status === 'PRESENT',
                                    'bg-red-50 text-red-700 ring-red-600/20':
                                      record.status === 'ABSENT',
                                    'bg-yellow-50 text-yellow-700 ring-yellow-600/20':
                                      record.status === 'LATE',
                                    'bg-blue-50 text-blue-700 ring-blue-600/20':
                                      record.status === 'EXCUSED',
                                  }
                                )}
                              >
                                {record.status.charAt(0) +
                                  record.status.slice(1).toLowerCase()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  )
}
