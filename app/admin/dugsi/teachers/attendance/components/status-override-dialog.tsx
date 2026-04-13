'use client'

import { useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'

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
import { cn } from '@/lib/utils'
import { getAllowedTransitions } from '@/lib/utils/attendance-transitions'
import type { OverrideAttendanceStatusInput } from '@/lib/validations/teacher-attendance'

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

function statusButtonClass(
  s: OverrideAttendanceStatusInput['toStatus'],
  selected: boolean
) {
  return cn(
    'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
    selected ? 'ring-2 ring-ring ring-offset-1' : 'hover:bg-accent',
    ATTENDANCE_STATUS_CONFIG[s].className
  )
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
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toStatus, setToStatus] = useState<
    OverrideAttendanceStatusInput['toStatus'] | null
  >(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Filter to overrideable statuses only — EXPECTED (slot generation) and CLOSED
  // (markDateClosed) have dedicated flows and must not appear in the manual override dialog.
  const allowedTransitions = getAllowedTransitions(currentStatus).filter(
    (s): s is OverrideAttendanceStatusInput['toStatus'] =>
      (s === 'PRESENT' || s === 'LATE' || s === 'ABSENT' || s === 'EXCUSED') &&
      s !== currentStatus
  )

  function handleSubmit() {
    if (!toStatus) return
    setError(null)

    startTransition(async () => {
      const result = await overrideAttendanceStatusAction({
        recordId,
        toStatus,
        notes: notes || undefined,
      })

      if (result?.serverError || result?.validationErrors) {
        // A concurrent override or auto-mark cron may have changed the status
        // since this dialog opened — the displayed options may no longer apply.
        setError(
          `${result.serverError ?? 'Invalid request.'} Please close and reopen the dialog to see the current status.`
        )
        return
      }

      onOpenChange(false)
      setToStatus(null)
      setNotes('')
      // after(revalidateAll) defers the cache invalidation to after the HTTP response,
      // so the Server Component grid won't re-render automatically. router.refresh()
      // triggers a fresh fetch of the current route's Server Component data.
      router.refresh()
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

          {currentStatus === 'CLOSED' && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This date is marked as a school closure. Overriding changes only
              this teacher&apos;s record — the school-wide closure and all other
              CLOSED records remain unchanged. Use the Closures page to remove
              the closure entirely.
            </p>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Change to</Label>
            <div className="flex flex-wrap gap-2">
              {allowedTransitions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setToStatus(s)}
                  className={statusButtonClass(s, toStatus === s)}
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
