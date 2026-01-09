'use client'

import { useState, useTransition } from 'react'

import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'
import { SHIFT_BADGES } from '@/lib/constants/dugsi'
import { cn } from '@/lib/utils'

import { CheckinRecord, updateCheckinAction } from '../actions'
import { formatFullDate } from './date-utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  checkin: CheckinRecord
  onSuccess?: () => void
}

function formatDateForInput(date: Date | null | undefined): string {
  if (!date) return ''
  try {
    return format(new Date(date), "yyyy-MM-dd'T'HH:mm")
  } catch (error) {
    console.error('Failed to format date for input:', date, error)
    return ''
  }
}

export function EditCheckinDialog({
  open,
  onOpenChange,
  checkin,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [clockInTime, setClockInTime] = useState(
    formatDateForInput(checkin.clockInTime)
  )
  const [clockOutTime, setClockOutTime] = useState(
    checkin.clockOutTime ? formatDateForInput(checkin.clockOutTime) : ''
  )
  const [isLate, setIsLate] = useState(checkin.isLate)
  const [clockInValid, setClockInValid] = useState(checkin.clockInValid)
  const [notes, setNotes] = useState(checkin.notes || '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await updateCheckinAction({
        checkInId: checkin.id,
        clockInTime: new Date(clockInTime),
        clockOutTime: clockOutTime ? new Date(clockOutTime) : null,
        isLate,
        clockInValid,
        notes: notes || null,
      })

      if (result.success) {
        onSuccess?.()
      } else {
        setError(result.error || 'Failed to update check-in')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Check-in</DialogTitle>
          <DialogDescription>
            {checkin.teacherName} - {formatFullDate(checkin.date)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('text-xs', SHIFT_BADGES[checkin.shift].className)}
            >
              {SHIFT_BADGES[checkin.shift].label}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clockInTime">Clock In Time</Label>
            <Input
              id="clockInTime"
              type="datetime-local"
              value={clockInTime}
              onChange={(e) => setClockInTime(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clockOutTime">Clock Out Time</Label>
            <Input
              id="clockOutTime"
              type="datetime-local"
              value={clockOutTime}
              onChange={(e) => setClockOutTime(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty if not clocked out yet
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="isLate"
                checked={isLate}
                onCheckedChange={(checked) => setIsLate(checked === true)}
              />
              <Label htmlFor="isLate" className="cursor-pointer">
                Mark as late arrival
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="clockInValid"
                checked={clockInValid}
                onCheckedChange={(checked) => setClockInValid(checked === true)}
              />
              <Label htmlFor="clockInValid" className="cursor-pointer">
                Valid location (within geofence)
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this check-in..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {notes.length}/500 characters
            </p>
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
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
