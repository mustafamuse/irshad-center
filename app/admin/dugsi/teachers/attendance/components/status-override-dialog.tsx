'use client'

import { useState, useTransition } from 'react'

import { Shift, TeacherAttendanceStatus } from '@prisma/client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ATTENDANCE_STATUS_CONFIG } from '@/lib/constants/attendance-status'
import { getAllowedTransitions } from '@/lib/utils/attendance-transitions'

import { overrideAttendanceStatusAction } from '../actions'
import { AttendanceStatusBadge } from './status-badge'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordId: string
  teacherName: string
  date: string
  shift: Shift
  currentStatus: TeacherAttendanceStatus
}

export function StatusOverrideDialog({
  open,
  onOpenChange,
  recordId,
  teacherName,
  date,
  shift,
  currentStatus,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [toStatus, setToStatus] = useState<TeacherAttendanceStatus | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const allowedTransitions = getAllowedTransitions(currentStatus)

  function handleSubmit() {
    if (!toStatus) return
    setError(null)

    startTransition(async () => {
      const result = await overrideAttendanceStatusAction({ recordId, toStatus, notes: notes || undefined })

      if (result?.serverError) {
        // A concurrent override or auto-mark cron may have changed the status
        // since this dialog opened — the displayed options may no longer apply.
        setError(`${result.serverError} Please close and reopen the dialog to see the current status.`)
        return
      }

      onOpenChange(false)
      setToStatus(null)
      setNotes('')
    })
  }

  function handleClose() {
    setToStatus(null)
    setNotes('')
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override Attendance Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{teacherName}</span>
            {' — '}
            {date} {shift === 'MORNING' ? 'Morning' : 'Afternoon'}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Current:</span>
            <AttendanceStatusBadge status={currentStatus} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Change to</Label>
            <div className="flex flex-wrap gap-2">
              {allowedTransitions.map((s) => (
                <button
                  key={s}
                  onClick={() => setToStatus(s)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    toStatus === s
                      ? 'ring-2 ring-ring ring-offset-1'
                      : 'hover:bg-accent'
                  } ${ATTENDANCE_STATUS_CONFIG[s].className}`}
                >
                  {ATTENDANCE_STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for override..."
              rows={2}
              maxLength={500}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!toStatus || isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
