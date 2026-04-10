'use client'

import { useState, useTransition } from 'react'

import { formatInTimeZone } from 'date-fns-tz'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { ExcuseRequestWithRelations } from '@/lib/db/queries/teacher-attendance'

import { approveExcuseAction, rejectExcuseAction } from '../attendance/actions'

interface Props {
  initialRequests: ExcuseRequestWithRelations[]
}

export function ExcuseQueue({ initialRequests }: Props) {
  const [, startTransition] = useTransition()
  const [requests, setRequests] = useState<ExcuseRequestWithRelations[]>(initialRequests)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  // Set of in-flight request IDs so multiple rows can be independently disabled
  // (a single string would re-enable a row when a different row's action completes)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  function handleApprove(id: string) {
    setErrors((prev) => ({ ...prev, [id]: null }))
    setPendingIds((prev) => new Set(prev).add(id))
    startTransition(async () => {
      const result = await approveExcuseAction({ excuseRequestId: id, adminNote: adminNotes[id] })
      setPendingIds((prev) => { const s = new Set(prev); s.delete(id); return s })
      if (result?.serverError) {
        setErrors((prev) => ({ ...prev, [id]: `${result.serverError} — refresh to see latest.` }))
        return
      }
      setRequests((prev) => prev.filter((r) => r.id !== id))
    })
  }

  function handleReject(id: string) {
    setErrors((prev) => ({ ...prev, [id]: null }))
    setPendingIds((prev) => new Set(prev).add(id))
    startTransition(async () => {
      const result = await rejectExcuseAction({ excuseRequestId: id, adminNote: adminNotes[id] })
      setPendingIds((prev) => { const s = new Set(prev); s.delete(id); return s })
      if (result?.serverError) {
        setErrors((prev) => ({ ...prev, [id]: `${result.serverError} — refresh to see latest.` }))
        return
      }
      setRequests((prev) => prev.filter((r) => r.id !== id))
    })
  }

  if (requests.length === 0)
    return <p className="text-sm text-muted-foreground">No pending excuse requests.</p>

  return (
    <div className="space-y-4">
      {requests.map((req) => {
        const record = req.attendanceRecord
        const teacherName = record.teacher.person.name
        const dateStr = formatInTimeZone(record.date, 'UTC', 'EEE MMM d, yyyy')
        const shiftLabel = record.shift === 'MORNING' ? 'Morning' : 'Afternoon'

        return (
          <div key={req.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{teacherName}</p>
                <p className="text-xs text-muted-foreground">
                  {dateStr} · {shiftLabel} · was{' '}
                  <span className="font-medium">{record.status}</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatInTimeZone(req.createdAt, SCHOOL_TIMEZONE, 'MMM d, h:mm a')}
              </p>
            </div>

            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <p className="font-medium text-xs text-muted-foreground mb-1">Teacher's reason</p>
              {req.reason}
            </div>

            <div className="space-y-1">
              <Textarea
                placeholder="Admin note (optional)..."
                rows={2}
                value={adminNotes[req.id] ?? ''}
                onChange={(e) => setAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
              />
            </div>

            {errors[req.id] && (
              <p className="text-sm text-red-600">{errors[req.id]}</p>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(req.id)}
                disabled={pendingIds.has(req.id)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(req.id)}
                disabled={pendingIds.has(req.id)}
              >
                Reject
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
