'use client'

import { useState } from 'react'

import { formatInTimeZone } from 'date-fns-tz'
import { Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AttendanceFetchError } from '@/lib/features/attendance/client'
import type { ClosureDto } from '@/lib/features/attendance/contracts'
import {
  useAdminClosuresQuery,
  useMarkClosureMutation,
  useRemoveClosureMutation,
} from '@/lib/features/attendance/hooks/admin'

export function ClosuresManager() {
  const closuresQuery = useAdminClosuresQuery()
  const markMutation = useMarkClosureMutation()
  const removeMutation = useRemoveClosureMutation()

  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<ClosureDto | null>(null)
  const [reopenWarning, setReopenWarning] = useState<string | null>(null)

  async function handleAdd() {
    if (!date || !reason.trim()) return
    setAddError(null)
    try {
      await markMutation.mutateAsync({ date, reason })
      setDate('')
      setReason('')
    } catch (err) {
      if (err instanceof AttendanceFetchError) {
        setAddError(err.message)
      } else if (err instanceof Error) {
        setAddError(err.message)
      } else {
        setAddError('Failed to mark date closed')
      }
    }
  }

  async function handleConfirmRemove() {
    if (!pendingRemoval) return
    setRemoveError(null)
    setReopenWarning(null)
    const dateStr = pendingRemoval.date
    try {
      const result = await removeMutation.mutateAsync(dateStr)
      const reopenedCount = result.reopenedCount ?? 0
      if (
        reopenedCount > 0 &&
        new Date(`${dateStr}T00:00:00.000Z`) < new Date()
      ) {
        setReopenWarning(
          `${reopenedCount} record${reopenedCount === 1 ? '' : 's'} reverted to EXPECTED. ` +
            'Teachers previously auto-marked LATE will not be re-marked automatically — ' +
            'review and correct them in the attendance grid.'
        )
      }
      setPendingRemoval(null)
    } catch (err) {
      if (err instanceof AttendanceFetchError) {
        setRemoveError(err.message)
      } else if (err instanceof Error) {
        setRemoveError(err.message)
      } else {
        setRemoveError('Failed to remove closure')
      }
      setPendingRemoval(null)
    }
  }

  const closures = closuresQuery.data ?? []
  const isAddPending = markMutation.isPending
  const isRemovePending = removeMutation.isPending

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Add Closure</h2>

        <div className="space-y-2">
          <Label htmlFor="closure-date">Date</Label>
          <Input
            id="closure-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="closure-reason">Reason</Label>
          <Textarea
            id="closure-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Spring break, Holiday..."
            rows={2}
            maxLength={500}
          />
        </div>

        {addError && <p className="text-sm text-red-600">{addError}</p>}
        {reopenWarning && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {reopenWarning}
          </p>
        )}

        <Button
          onClick={() => void handleAdd()}
          disabled={!date || !reason.trim() || isAddPending}
        >
          {isAddPending ? 'Saving...' : 'Mark Closed'}
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Existing Closures</h2>
        {removeError && <p className="text-sm text-red-600">{removeError}</p>}
        {closuresQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : closures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No closures recorded.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {closures.map((c) => {
              const dateLabel = formatInTimeZone(
                new Date(`${c.date}T00:00:00.000Z`),
                'UTC',
                'EEE MMM d, yyyy'
              )
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{dateLabel}</p>
                    <p className="text-xs text-muted-foreground">{c.reason}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingRemoval(c)}
                    disabled={isRemovePending}
                    aria-label={`Remove closure for ${dateLabel}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!pendingRemoval}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove closure?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval && (
                <>
                  Remove closure for{' '}
                  <span className="font-medium">
                    {formatInTimeZone(
                      new Date(`${pendingRemoval.date}T00:00:00.000Z`),
                      'UTC',
                      'EEE MMM d, yyyy'
                    )}
                  </span>
                  ? All CLOSED records for this date will revert to EXPECTED.{' '}
                  Any teachers that were auto-marked LATE before this date was
                  closed will also revert to EXPECTED — you may need to manually
                  correct them in the attendance grid.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmRemove()}
              disabled={isRemovePending}
            >
              {isRemovePending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
