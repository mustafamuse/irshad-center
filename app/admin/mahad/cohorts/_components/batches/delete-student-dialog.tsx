'use client'

import { useEffect, useState, useTransition } from 'react'

import { AlertTriangle, UserX } from 'lucide-react'
import { toast } from 'sonner'

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
import { Badge } from '@/components/ui/badge'

import {
  deleteStudentAction,
  getStudentDeleteWarningsAction,
} from '../../_actions'

interface DeleteStudentDialogProps {
  studentId: string
  studentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface DeleteWarnings {
  hasSiblings: boolean
  hasAttendanceRecords: boolean
}

export function DeleteStudentDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
  onSuccess,
}: DeleteStudentDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [warnings, setWarnings] = useState<DeleteWarnings | null>(null)
  const [isLoadingWarnings, setIsLoadingWarnings] = useState(false)

  // Fetch warnings when dialog opens
  useEffect(() => {
    if (open && !warnings) {
      setIsLoadingWarnings(true)
      getStudentDeleteWarningsAction(studentId)
        .then((result) => {
          setWarnings(result.data)
        })
        .catch((error) => {
          console.error('Failed to fetch delete warnings:', error)
          setWarnings({ hasSiblings: false, hasAttendanceRecords: false })
        })
        .finally(() => {
          setIsLoadingWarnings(false)
        })
    }
  }, [open, studentId, warnings])

  // Reset warnings when dialog closes
  useEffect(() => {
    if (!open) {
      setWarnings(null)
    }
  }, [open])

  const handleDelete = async () => {
    startTransition(async () => {
      const result = await deleteStudentAction(studentId)
      if (result.success) {
        toast.success(`Successfully deleted ${studentName}`)
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast.error(result.error || 'Failed to delete student')
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-red-500" />
            Delete Student
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete <strong>{studentName}</strong>?
              </p>

              {/* Reserve space for warnings to prevent layout shift */}
              <div className="min-h-[60px]">
                {isLoadingWarnings && (
                  <p className="text-sm text-muted-foreground">
                    Checking for dependencies...
                  </p>
                )}

                {!isLoadingWarnings &&
                  warnings &&
                  (warnings.hasSiblings || warnings.hasAttendanceRecords) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-amber-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Warning:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {warnings.hasSiblings && (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-700"
                          >
                            Has sibling relationships
                          </Badge>
                        )}
                        {warnings.hasAttendanceRecords && (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-700"
                          >
                            Has attendance records
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
              </div>

              <p className="text-sm font-medium text-red-600">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending || isLoadingWarnings}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? 'Deleting...' : 'Delete Student'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
