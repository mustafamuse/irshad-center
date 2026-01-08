'use client'

import { useState, useTransition } from 'react'

import { format } from 'date-fns'
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
import { cn } from '@/lib/utils'

import { CheckinRecord, deleteCheckinAction } from '../actions'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  checkin: CheckinRecord
  onSuccess?: () => void
}

function formatDate(date: Date): string {
  return format(new Date(date), 'EEEE, MMMM d, yyyy')
}

function formatTime(date: Date): string {
  return format(new Date(date), 'h:mm a')
}

export function DeleteCheckinDialog({
  open,
  onOpenChange,
  checkin,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    setError(null)

    startTransition(async () => {
      const result = await deleteCheckinAction(checkin.id)

      if (result.success) {
        onSuccess?.()
      } else {
        setError(result.error || 'Failed to delete check-in')
      }
    })
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
            {formatDate(checkin.date)}
          </p>
          <p className="text-sm">
            {formatTime(checkin.clockInTime)}
            {checkin.clockOutTime && ` - ${formatTime(checkin.clockOutTime)}`}
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
