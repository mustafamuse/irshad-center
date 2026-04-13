'use client'

import { useState } from 'react'

import { formatInTimeZone } from 'date-fns-tz'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ATTENDANCE_STATUS_CONFIG } from '@/lib/constants/attendance-status'
import { SCHOOL_TIMEZONE } from '@/lib/constants/shift-times'
import { AttendanceFetchError } from '@/lib/features/attendance/client'
import {
  useAdminExcuseQueueQuery,
  useReviewExcuseMutation,
} from '@/lib/features/attendance/hooks/admin'

export function ExcuseQueue() {
  const query = useAdminExcuseQueueQuery()
  const reviewMutation = useReviewExcuseMutation()

  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})

  async function handleDecision(id: string, action: 'approve' | 'reject') {
    setErrors((prev) => ({ ...prev, [id]: null }))
    try {
      await reviewMutation.mutateAsync({
        action,
        excuseRequestId: id,
        adminNote: adminNotes[id] || undefined,
      })
      setAdminNotes((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (err) {
      let msg = 'Something went wrong — refresh to see latest.'
      if (err instanceof AttendanceFetchError || err instanceof Error) {
        msg = `${err.message} — refresh to see latest.`
      }
      setErrors((prev) => ({ ...prev, [id]: msg }))
    }
  }

  const requests = query.data ?? []

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    )
  }

  if (query.error) {
    return (
      <p className="text-sm text-red-600">
        Failed to load excuse requests — {query.error.message}
      </p>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No pending excuse requests.
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Refresh
        </button>
      </div>
      {requests.map((req) => {
        const dateStr = formatInTimeZone(
          new Date(`${req.date}T00:00:00.000Z`),
          'UTC',
          'EEE MMM d, yyyy'
        )
        const shiftLabel = req.shift === 'MORNING' ? 'Morning' : 'Afternoon'
        const isPending =
          reviewMutation.isPending &&
          reviewMutation.variables?.excuseRequestId === req.id

        return (
          <div key={req.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{req.teacherName}</p>
                <p className="text-xs text-muted-foreground">
                  {dateStr} · {shiftLabel} · was{' '}
                  <span className="font-medium">
                    {ATTENDANCE_STATUS_CONFIG[req.recordStatus].label}
                  </span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatInTimeZone(
                  req.createdAt,
                  SCHOOL_TIMEZONE,
                  'MMM d, h:mm a'
                )}
              </p>
            </div>

            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Teacher&apos;s reason
              </p>
              {req.reason}
            </div>

            <div className="space-y-1">
              <Textarea
                placeholder="Admin note (optional)…"
                rows={2}
                value={adminNotes[req.id] ?? ''}
                onChange={(e) =>
                  setAdminNotes((prev) => ({
                    ...prev,
                    [req.id]: e.target.value,
                  }))
                }
              />
            </div>

            {errors[req.id] && (
              <p className="text-sm text-red-600">{errors[req.id]}</p>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => void handleDecision(req.id, 'approve')}
                disabled={isPending}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleDecision(req.id, 'reject')}
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
