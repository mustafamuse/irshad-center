'use client'

import { useEffect, useState, useTransition } from 'react'

import { format } from 'date-fns'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SHIFT_BADGES } from '@/lib/constants/dugsi'
import { cn } from '@/lib/utils'

import {
  CheckinHistoryItem,
  CheckinHistoryResult,
  getTeacherCheckinHistoryAction,
} from '../actions'

interface Props {
  teacherId: string
}

function formatTime(date: Date): string {
  return format(new Date(date), 'h:mm a')
}

function formatDate(date: Date): string {
  return format(new Date(date), 'EEE, MMM d')
}

export function CheckinHistoryTab({ teacherId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [history, setHistory] = useState<CheckinHistoryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadHistory(1)
  }, [teacherId])

  function loadHistory(page: number) {
    startTransition(async () => {
      const result = await getTeacherCheckinHistoryAction(teacherId, page)
      if (result.success && result.data) {
        setHistory(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to load history')
      }
    })
  }

  if (isPending && !history) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <p className="text-sm text-red-800">{error}</p>
      </div>
    )
  }

  if (!history || history.data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No check-in history in the last 30 days
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        {/* Desktop table */}
        <Table className="hidden sm:table">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.data.map((item: CheckinHistoryItem) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {formatDate(item.date)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      SHIFT_BADGES[item.shift].className
                    )}
                  >
                    {SHIFT_BADGES[item.shift].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {item.clockInValid ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span className="text-sm">
                      {formatTime(item.clockInTime)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {item.clockOutTime ? (
                    <span className="text-sm">
                      {formatTime(item.clockOutTime)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.isLate ? (
                    <Badge
                      variant="outline"
                      className="border-orange-200 bg-orange-100 text-orange-800"
                    >
                      Late
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-green-200 bg-green-100 text-green-800"
                    >
                      On Time
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Mobile cards */}
        <div className="divide-y sm:hidden">
          {history.data.map((item: CheckinHistoryItem) => (
            <div key={item.id} className="space-y-1 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {formatDate(item.date)}
                </span>
                <Badge
                  variant="outline"
                  className={cn('text-xs', SHIFT_BADGES[item.shift].className)}
                >
                  {SHIFT_BADGES[item.shift].label}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  {item.clockInValid ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  )}
                  <span>{formatTime(item.clockInTime)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span>
                    {item.clockOutTime ? formatTime(item.clockOutTime) : '—'}
                  </span>
                </div>
                {item.isLate ? (
                  <Badge
                    variant="outline"
                    className="border-orange-200 bg-orange-100 text-xs text-orange-800"
                  >
                    Late
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-green-200 bg-green-100 text-xs text-green-800"
                  >
                    On Time
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {history.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {history.page} of {history.totalPages} ({history.total}{' '}
            records)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadHistory(history.page - 1)}
              disabled={history.page <= 1 || isPending}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadHistory(history.page + 1)}
              disabled={history.page >= history.totalPages || isPending}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
