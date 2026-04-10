'use client'

import { useTransition, useState, useEffect } from 'react'

import { useRouter } from 'next/navigation'
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

import {
  markDateClosedAction,
  removeClosureAction,
} from '../../attendance/actions'

type Closure = { id: string; date: Date; reason: string }

interface Props {
  initialClosures: Closure[]
}

export function ClosuresManager({ initialClosures }: Props) {
  const router = useRouter()
  const [isAddPending, startAddTransition] = useTransition()
  const [isRemovePending, startRemoveTransition] = useTransition()
  const [closures, setClosures] = useState<Closure[]>(initialClosures)
  // Sync when the Server Component re-renders with fresh data (e.g. after router.refresh())
  useEffect(() => { setClosures(initialClosures) }, [initialClosures])
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<Closure | null>(null)
  const [reopenWarning, setReopenWarning] = useState<string | null>(null)

  function handleAdd() {
    if (!date || !reason.trim()) return
    setError(null)
    startAddTransition(async () => {
      const result = await markDateClosedAction({ date, reason })
      if (result?.serverError) {
        setError(result.serverError)
        return
      }
      if (result?.validationErrors) {
        // Surface the first field-level error (e.g. "School days are Saturday and Sunday only")
        const first = Object.values(result.validationErrors).flat().find(Boolean)
        if (first) { setError(String(first)); return }
      }
      // Optimistically append — id is a temp placeholder since dates are unique
      // and removal uses the date string, not the id.
      setClosures((prev) => [
        ...prev,
        { id: `_new-${date}`, date: new Date(`${date}T00:00:00.000Z`), reason },
      ])
      setDate('')
      setReason('')
      router.refresh()
    })
  }

  function handleRemove(closure: Closure) {
    const dateStr = formatInTimeZone(closure.date, 'UTC', 'yyyy-MM-dd')
    setError(null)
    setReopenWarning(null)
    startRemoveTransition(async () => {
      const result = await removeClosureAction({ date: dateStr })
      if (result?.serverError) {
        setError(result.serverError)
        setPendingRemoval(null)
        return
      }
      const reopenedCount = result?.data?.reopenedCount ?? 0
      // Warn when a historical closure is removed and EXPECTED records may be stranded:
      // the auto-mark cron only runs for today, so formerly AUTO_MARKED LATE records
      // that were flipped CLOSED will now sit as EXPECTED with no automatic correction.
      if (reopenedCount > 0 && closure.date < new Date()) {
        setReopenWarning(
          `${reopenedCount} record${reopenedCount === 1 ? '' : 's'} reverted to EXPECTED. ` +
          'Teachers previously auto-marked LATE will not be re-marked automatically — ' +
          'review and correct them in the attendance grid.'
        )
      }
      setClosures((prev) => prev.filter((c) => c.id !== closure.id))
      setPendingRemoval(null)
      router.refresh()
    })
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-lg border p-4 space-y-4">
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

        {error && <p className="text-sm text-red-600">{error}</p>}
        {reopenWarning && <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2">{reopenWarning}</p>}

        <Button onClick={handleAdd} disabled={!date || !reason.trim() || isAddPending}>
          {isAddPending ? 'Saving...' : 'Mark Closed'}
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Existing Closures</h2>
        {closures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No closures recorded.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {closures.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {formatInTimeZone(c.date, 'UTC', 'EEE MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingRemoval(c)}
                  disabled={isRemovePending}
                  aria-label={`Remove closure for ${formatInTimeZone(c.date, 'UTC', 'EEE MMM d, yyyy')}`}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!pendingRemoval}
        onOpenChange={(open) => { if (!open) setPendingRemoval(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove closure?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval && (
                <>
                  Remove closure for{' '}
                  <span className="font-medium">
                    {formatInTimeZone(pendingRemoval.date, 'UTC', 'EEE MMM d, yyyy')}
                  </span>
                  ? All CLOSED records for this date will revert to EXPECTED.{' '}
                  Any teachers that were auto-marked LATE before this date was closed will also revert to EXPECTED — you may need to manually correct them in the attendance grid.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRemoval && handleRemove(pendingRemoval)}
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
