'use client'

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

import { useActionHandler } from '../../_hooks/use-action-handler'
import { reEnrollChildAction } from '../../actions'

interface ReEnrollChildDialogProps {
  studentId: string
  childName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ReEnrollChildDialog({
  studentId,
  childName,
  open,
  onOpenChange,
  onSuccess,
}: ReEnrollChildDialogProps) {
  const { execute: executeReEnroll, isPending } = useActionHandler(
    reEnrollChildAction,
    {
      onSuccess: () => {
        onOpenChange(false)
        onSuccess?.()
      },
    }
  )

  const handleSubmit = () => {
    executeReEnroll({ studentId })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Re-enroll Child</AlertDialogTitle>
          <AlertDialogDescription>
            Re-enroll <strong>{childName}</strong> in the Dugsi program? Billing
            will be recalculated automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Re-enrolling...' : 'Re-enroll'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
