'use client'

import { useEffect, useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import {
  deleteStudentAction,
  getStudentDeleteWarningsAction,
} from '../../_actions'

interface DeleteWarnings {
  hasSiblings: boolean
  hasAttendanceRecords: boolean
}

interface DeleteStudentDialogProps {
  studentId: string
  studentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteStudentDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
  onDeleted,
}: DeleteStudentDialogProps): React.ReactElement {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [warnings, setWarnings] = useState<DeleteWarnings | null>(null)

  useEffect(() => {
    if (!open || !studentId) {
      setWarnings(null)
      return
    }

    let cancelled = false
    getStudentDeleteWarningsAction(studentId).then((result) => {
      if (cancelled) return
      if (result.success && result.data) {
        setWarnings(result.data)
      } else {
        toast.error('Failed to load deletion warnings')
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, studentId])

  function handleDelete(): void {
    startTransition(async () => {
      const result = await deleteStudentAction(studentId)

      if (result.success) {
        toast.success(`${studentName} has been deleted`)
        onOpenChange(false)
        onDeleted?.()
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to delete student')
      }
    })
  }

  const hasWarnings = warnings?.hasSiblings || warnings?.hasAttendanceRecords

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Student
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{studentName}</strong>? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasWarnings && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-1">
                {warnings?.hasSiblings && (
                  <p>
                    This student has sibling relationships that will be removed.
                  </p>
                )}
                {warnings?.hasAttendanceRecords && (
                  <p>
                    This student has attendance records that will be deleted.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-muted-foreground">
            All associated data including enrollment records, payment history,
            and attendance will be permanently removed.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Student
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
