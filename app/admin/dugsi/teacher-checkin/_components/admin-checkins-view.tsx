'use client'

import { useState, useEffect, useTransition } from 'react'

import { Shift } from '@prisma/client'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import {
  CalendarIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
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
import { Textarea } from '@/components/ui/textarea'
import type { DugsiTeacherDTO } from '@/lib/db/queries/teacher'
import type { NoShowTeacher } from '@/lib/services/dugsi/teacher-checkin-service'
import type { TeacherCheckInDTO } from '@/lib/types/dugsi-attendance'
import { cn } from '@/lib/utils'

import {
  adminClockInAction,
  autoClockOutAction,
  getNoShowTeachersAction,
  getTeacherCheckInsAction,
} from '../actions'

interface AdminCheckInsViewProps {
  teachers: DugsiTeacherDTO[]
}

export function AdminCheckInsView({ teachers }: AdminCheckInsViewProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [checkIns, setCheckIns] = useState<TeacherCheckInDTO[]>([])
  const [noShows, setNoShows] = useState<{
    morning: NoShowTeacher[]
    afternoon: NoShowTeacher[]
  }>({
    morning: [],
    afternoon: [],
  })
  const [manualCheckInOpen, setManualCheckInOpen] = useState(false)
  const [manualCheckInData, setManualCheckInData] = useState({
    teacherId: '',
    shift: '' as Shift | '',
    reason: '',
  })

  useEffect(() => {
    loadCheckIns()
    loadNoShows()
    autoClockOutAction()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const loadCheckIns = async () => {
    startTransition(async () => {
      const result = await getTeacherCheckInsAction({
        startDate: startOfDay(selectedDate),
        endDate: endOfDay(selectedDate),
      })

      if (result.success && result.data) {
        setCheckIns(result.data)
      }
    })
  }

  const loadNoShows = async () => {
    const isToday =
      format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    if (!isToday) {
      setNoShows({ morning: [], afternoon: [] })
      return
    }

    const [morningResult, afternoonResult] = await Promise.all([
      getNoShowTeachersAction('MORNING'),
      getNoShowTeachersAction('AFTERNOON'),
    ])

    setNoShows({
      morning: morningResult.success ? (morningResult.data ?? []) : [],
      afternoon: afternoonResult.success ? (afternoonResult.data ?? []) : [],
    })
  }

  const handleManualCheckIn = async () => {
    if (
      !manualCheckInData.teacherId ||
      !manualCheckInData.shift ||
      !manualCheckInData.reason
    ) {
      toast.error('Please fill in all fields')
      return
    }

    startTransition(async () => {
      const result = await adminClockInAction({
        teacherId: manualCheckInData.teacherId,
        shift: manualCheckInData.shift as Shift,
        reason: manualCheckInData.reason,
      })

      if (result.success) {
        toast.success('Manual check-in recorded')
        setManualCheckInOpen(false)
        setManualCheckInData({ teacherId: '', shift: '', reason: '' })
        loadCheckIns()
        loadNoShows()
      } else {
        toast.error(result.error || 'Failed to record check-in')
      }
    })
  }

  const handleDateChange = (date: Date | undefined) => {
    if (date) setSelectedDate(date)
  }

  const handlePrevDay = () => {
    setSelectedDate((prev) => subDays(prev, 1))
  }

  const handleNextDay = () => {
    const tomorrow = new Date(selectedDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (tomorrow <= new Date()) {
      setSelectedDate(tomorrow)
    }
  }

  const isToday =
    format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  const totalNoShows = noShows.morning.length + noShows.afternoon.length

  const stats = {
    total: checkIns.length,
    onTime: checkIns.filter((c) => !c.isLate).length,
    late: checkIns.filter((c) => c.isLate).length,
    offSite: checkIns.filter((c) => !c.clockInValid).length,
  }

  return (
    <div className="space-y-6">
      {isToday && totalNoShows > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-800">
                Teachers Not Checked In
              </h3>
              <div className="mt-2 space-y-2">
                {noShows.morning.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-700">
                      Morning Shift:
                    </p>
                    <p className="text-sm text-yellow-700">
                      {noShows.morning.map((t) => t.teacherName).join(', ')}
                    </p>
                  </div>
                )}
                {noShows.afternoon.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-700">
                      Afternoon Shift:
                    </p>
                    <p className="text-sm text-yellow-700">
                      {noShows.afternoon.map((t) => t.teacherName).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
              onClick={() => setManualCheckInOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Manual Check-In
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">All Check-Ins</h2>
          <p className="text-sm text-muted-foreground">
            Admin view of teacher attendance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[180px] justify-start text-left font-normal',
                  !selectedDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'EEE, MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateChange}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextDay}
            disabled={isToday}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
            >
              Today
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Check-Ins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">On Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.onTime}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Late</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.late}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Off-Site</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.offSite}
            </div>
          </CardContent>
        </Card>
      </div>

      {isPending ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : checkIns.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">
            No check-ins for this date
          </p>
        </div>
      ) : (
        <>
          <div className="hidden rounded-md border lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkIns.map((checkIn) => (
                  <TableRow key={checkIn.id}>
                    <TableCell className="font-medium">
                      {checkIn.teacherName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          checkIn.shift === 'MORNING' ? 'default' : 'secondary'
                        }
                      >
                        {checkIn.shift === 'MORNING' ? 'Morning' : 'Afternoon'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(checkIn.clockInTime), 'h:mm a')}
                    </TableCell>
                    <TableCell>
                      {checkIn.clockOutTime
                        ? format(new Date(checkIn.clockOutTime), 'h:mm a')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {checkIn.isLate && (
                          <Badge variant="destructive" className="text-xs">
                            Late
                          </Badge>
                        )}
                        {!checkIn.clockInValid && (
                          <Badge variant="outline" className="text-xs">
                            Off-site
                          </Badge>
                        )}
                        {!checkIn.isLate && checkIn.clockInValid && (
                          <Badge
                            variant="outline"
                            className="border-green-300 text-xs text-green-700"
                          >
                            On time
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {checkIns.map((checkIn) => (
              <Card key={checkIn.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{checkIn.teacherName}</p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            checkIn.shift === 'MORNING'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {checkIn.shift === 'MORNING'
                            ? 'Morning'
                            : 'Afternoon'}
                        </Badge>
                        {checkIn.isLate && (
                          <Badge variant="destructive" className="text-xs">
                            Late
                          </Badge>
                        )}
                        {!checkIn.clockInValid && (
                          <Badge variant="outline" className="text-xs">
                            Off-site
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>
                        In: {format(new Date(checkIn.clockInTime), 'h:mm a')}
                      </p>
                      {checkIn.clockOutTime && (
                        <p>
                          Out:{' '}
                          {format(new Date(checkIn.clockOutTime), 'h:mm a')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={manualCheckInOpen} onOpenChange={setManualCheckInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Check-In</DialogTitle>
            <DialogDescription>
              Record a check-in for a teacher who couldn&apos;t use the regular
              check-in process.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Teacher</Label>
              <Select
                value={manualCheckInData.teacherId}
                onValueChange={(v) =>
                  setManualCheckInData((prev) => ({ ...prev, teacherId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select
                value={manualCheckInData.shift}
                onValueChange={(v) =>
                  setManualCheckInData((prev) => ({
                    ...prev,
                    shift: v as Shift,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MORNING">Morning</SelectItem>
                  <SelectItem value="AFTERNOON">Afternoon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Why is this check-in being recorded manually?"
                value={manualCheckInData.reason}
                onChange={(e) =>
                  setManualCheckInData((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setManualCheckInOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleManualCheckIn} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Record Check-In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
