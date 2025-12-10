import { AlertTriangle } from 'lucide-react'

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

interface DeletePersonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  personName: string
  onConfirm: () => void
  deleting: boolean
}

export function DeletePersonDialog({
  open,
  onOpenChange,
  personName,
  onConfirm,
  deleting,
}: DeletePersonDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Delete Person Entirely?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will <strong>permanently delete</strong> {personName} and
                all associated data:
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                <li>All contact information</li>
                <li>Teacher role and student assignments</li>
                <li>Student enrollments and program profiles</li>
                <li>Parent relationships with children</li>
                <li>Billing accounts and subscriptions</li>
              </ul>
              <p className="font-semibold text-red-600">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleting ? 'Deleting...' : 'Delete Permanently'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
