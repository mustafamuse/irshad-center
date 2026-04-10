'use client'

import { useEffect, useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ExcuseRequestWithRelations } from '@/lib/db/queries/teacher-attendance'

import { getExcuseQueue, approveExcuseAction, rejectExcuseAction } from '../attendance/actions'

export function ExcuseQueue() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [requests, setRequests] = useState<ExcuseRequestWithRelations[]>([])
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  async function reload() {
    const data = await getExcuseQueue()
    setRequests(data)
    setIsLoading(false)
  }

  useEffect(() => { reload() }, [])

  function handleApprove(id: string) {
    startTransition(async () => {
      await approveExcuseAction({ excuseRequestId: id, adminNote: adminNotes[id] })
      router.refresh()
      reload()
    })
  }

  function handleReject(id: string) {
    startTransition(async () => {
      await rejectExcuseAction({ excuseRequestId: id, adminNote: adminNotes[id] })
      router.refresh()
      reload()
    })
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>
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
                {formatInTimeZone(req.createdAt, 'America/Chicago', 'MMM d, h:mm a')}
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

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(req.id)}
                disabled={isPending}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(req.id)}
                disabled={isPending}
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
