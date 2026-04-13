'use client'

import { useState } from 'react'

import { AlertTriangle, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SHIFT_BADGES } from '@/lib/constants/dugsi'
import { AttendanceFetchError } from '@/lib/features/attendance/client'
import { useDeleteCheckinMutation } from '@/lib/features/attendance/hooks/admin'
import { cn } from '@/lib/utils'

import { CheckinRecord } from '../actions'
import { formatCheckinTime, formatFullDate } from './date-utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  checkin: CheckinRecord
  onSuccess?: () => void
}

export function DeleteCheckinDialog({
  open,
  onOpenChange,
  checkin,
  onSuccess,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const mutation = useDeleteCheckinMutation()

  async function handleDelete() {
    setError(null)
    try {
      await mutation.mutateAsync(checkin.id)
      onSuccess?.()
    } catch (err) {
      if (err instanceof AttendanceFetchError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to delete check-in')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Delete Check-in
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. The check-in record will be
            permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">{checkin.teacherName}</p>
            <Badge
              variant="outline"
              className={cn('text-xs', SHIFT_BADGES[checkin.shift].className)}
            >
              {SHIFT_BADGES[checkin.shift].label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatFullDate(checkin.date)}
          </p>
          <p className="text-sm">
            {formatCheckinTime(checkin.clockInTime)}
            {checkin.clockOutTime &&
              ` - ${formatCheckinTime(checkin.clockOutTime)}`}
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
