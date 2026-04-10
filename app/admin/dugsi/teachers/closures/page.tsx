'use client'

import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'

import { formatInTimeZone } from 'date-fns-tz'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { markDateClosedAction, removeClosureAction, getAdminClosures } from '../attendance/actions'
import { useEffect } from 'react'

type Closure = { id: string; date: Date; reason: string }

export default function ClosuresPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [closures, setClosures] = useState<Closure[]>([])
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getAdminClosures().then((data) => {
      setClosures(data as Closure[])
      setIsLoading(false)
    })
  }, [])

  function handleAdd() {
    if (!date || !reason.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await markDateClosedAction({ date, reason })
      if (result?.serverError) {
        setError(result.serverError)
        return
      }
      setDate('')
      setReason('')
      router.refresh()
      const updated = await getAdminClosures()
      setClosures(updated as Closure[])
    })
  }

  function handleRemove(closureDate: Date) {
    const dateStr = formatInTimeZone(closureDate, 'UTC', 'yyyy-MM-dd')
    startTransition(async () => {
      await removeClosureAction({ date: dateStr })
      router.refresh()
      const updated = await getAdminClosures()
      setClosures(updated as Closure[])
    })
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">School Closures</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mark dates as closed. All EXPECTED attendance records for that date will be set to CLOSED automatically.
        </p>
      </div>

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
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleAdd} disabled={!date || !reason.trim() || isPending}>
          {isPending ? 'Saving...' : 'Mark Closed'}
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Existing Closures</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : closures.length === 0 ? (
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
                  onClick={() => handleRemove(c.date)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
