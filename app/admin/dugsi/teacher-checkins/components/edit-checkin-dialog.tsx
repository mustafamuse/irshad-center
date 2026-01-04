'use client'

import { useEffect, useState, useTransition } from 'react'

import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'

import { toast } from '@/components/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import type { TeacherCheckinWithRelations } from '../_types'
import { updateCheckinAction } from '../actions'

interface EditCheckinDialogProps {
  checkin: TeacherCheckinWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditCheckinDialog({
  checkin,
  open,
  onOpenChange,
}: EditCheckinDialogProps) {
  const [isPending, startTransition] = useTransition()

  const [clockInTime, setClockInTime] = useState('')
  const [clockOutTime, setClockOutTime] = useState('')
  const [isLate, setIsLate] = useState(false)
  const [clockInValid, setClockInValid] = useState(true)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (checkin) {
      setClockInTime(
        format(new Date(checkin.clockInTime), "yyyy-MM-dd'T'HH:mm")
      )
      setClockOutTime(
        checkin.clockOutTime
          ? format(new Date(checkin.clockOutTime), "yyyy-MM-dd'T'HH:mm")
          : ''
      )
      setIsLate(checkin.isLate)
      setClockInValid(checkin.clockInValid)
      setNotes(checkin.notes || '')
    }
  }, [checkin])

  const handleSubmit = () => {
    if (!checkin) return

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
        toast.success('Success', { description: result.message })
        onOpenChange(false)
      } else {
        toast.error('Error', { description: result.error })
      }
    })
  }

  if (!checkin) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Check-in</SheetTitle>
          <SheetDescription>
            {checkin.teacher.person.name} - {checkin.shift} shift on{' '}
            {format(new Date(checkin.date), 'MMM d, yyyy')}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="clockInTime">Clock In Time</Label>
            <Input
              id="clockInTime"
              type="datetime-local"
              value={clockInTime}
              onChange={(e) => setClockInTime(e.target.value)}
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
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isLate">Mark as Late</Label>
            <Switch id="isLate" checked={isLate} onCheckedChange={setIsLate} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="clockInValid">Valid Location</Label>
            <Switch
              id="clockInValid"
              checked={clockInValid}
              onCheckedChange={setClockInValid}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional admin notes..."
              rows={3}
            />
          </div>
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
