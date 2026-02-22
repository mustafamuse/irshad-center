'use client'

import { useState, useTransition } from 'react'

import { Shift } from '@prisma/client'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  SCHOOL_TIMEZONE,
  SHIFT_START_TIMES,
  SHIFT_TIME_LABELS,
} from '@/lib/constants/teacher-checkin'

import { adminClockInAction } from '../actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  teacherId: string
  teacherName: string
  shift: Shift
  date: Date
  onSuccess?: () => void
}

function isTodayInSchoolTz(date: Date): boolean {
  const now = toZonedTime(new Date(), SCHOOL_TIMEZONE)
  const d = toZonedTime(date, SCHOOL_TIMEZONE)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function getShiftStartTimeString(shift: Shift): string {
  const { hour, minute } = SHIFT_START_TIMES[shift]
  return `${pad(hour)}:${pad(minute)}`
}

function getCurrentTimeInSchoolTz(): string {
  const now = toZonedTime(new Date(), SCHOOL_TIMEZONE)
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function AdminCheckinDialog({
  open,
  onOpenChange,
  teacherId,
  teacherName,
  shift,
  date,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [timeOption, setTimeOption] = useState<
    'shift-start' | 'now' | 'custom'
  >('shift-start')
  const [customTime, setCustomTime] = useState(getShiftStartTimeString(shift))

  const showNowOption = isTodayInSchoolTz(date)

  function getClockInTime(): Date {
    let timeStr: string
    if (timeOption === 'shift-start') {
      timeStr = getShiftStartTimeString(shift)
    } else if (timeOption === 'now') {
      timeStr = getCurrentTimeInSchoolTz()
    } else {
      timeStr = customTime
    }

    const [hours, minutes] = timeStr.split(':').map(Number)
    const zonedDate = new Date(date)
    zonedDate.setHours(hours, minutes, 0, 0)
    return fromZonedTime(zonedDate, SCHOOL_TIMEZONE)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const clockInTime = getClockInTime()
      const result = await adminClockInAction({
        teacherId,
        shift,
        date,
        clockInTime,
      })

      if (result.success) {
        onSuccess?.()
      } else {
        setError(result.error || 'Failed to check in teacher')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Check In Teacher</DialogTitle>
          <DialogDescription>
            {teacherName} - {shift === 'MORNING' ? 'Morning' : 'Afternoon'}{' '}
            Shift
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>Clock-in Time</Label>
            <RadioGroup
              value={timeOption}
              onValueChange={(v) =>
                setTimeOption(v as 'shift-start' | 'now' | 'custom')
              }
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="shift-start" id="shift-start" />
                <Label
                  htmlFor="shift-start"
                  className="cursor-pointer font-normal"
                >
                  Shift start ({SHIFT_TIME_LABELS[shift]})
                </Label>
              </div>

              {showNowOption && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="now" id="now" />
                  <Label htmlFor="now" className="cursor-pointer font-normal">
                    Now
                  </Label>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="cursor-pointer font-normal">
                  Custom time
                </Label>
              </div>
            </RadioGroup>

            {timeOption === 'custom' && (
              <Input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-32"
                required
              />
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check In
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
