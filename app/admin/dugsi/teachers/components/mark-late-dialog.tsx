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
import {
  SCHOOL_TIMEZONE,
  SHIFT_START_TIMES,
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

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function getDefaultLateTime(shift: Shift, date: Date): string {
  const now = toZonedTime(new Date(), SCHOOL_TIMEZONE)
  const d = toZonedTime(date, SCHOOL_TIMEZONE)
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  if (isToday) {
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`
  }

  const { hour, minute } = SHIFT_START_TIMES[shift]
  const lateTime = new Date(2000, 0, 1, hour, minute + 30)
  return `${pad(lateTime.getHours())}:${pad(lateTime.getMinutes())}`
}

export function MarkLateDialog({
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
  const [arrivalTime, setArrivalTime] = useState(
    getDefaultLateTime(shift, date)
  )

  const shiftLabel = shift === 'MORNING' ? 'Morning' : 'Afternoon'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const [hours, minutes] = arrivalTime.split(':').map(Number)
    const d = toZonedTime(date, SCHOOL_TIMEZONE)
    const clockInTime = fromZonedTime(
      new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        hours,
        minutes,
        0,
        0
      ),
      SCHOOL_TIMEZONE
    )

    if (isNaN(clockInTime.getTime())) {
      setError('Invalid time entered')
      return
    }

    startTransition(async () => {
      const result = await adminClockInAction({
        teacherId,
        shift,
        date,
        clockInTime,
      })

      if (result.success) {
        onSuccess?.()
      } else {
        setError(result.error || 'Failed to mark teacher as late')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark as Late</DialogTitle>
          <DialogDescription>
            {teacherName} — {shiftLabel} Shift
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="arrival-time">Arrival Time</Label>
            <Input
              id="arrival-time"
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className="w-32"
              required
            />
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
              Mark Late
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
