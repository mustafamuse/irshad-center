'use client'

import { useEffect, useState, useTransition } from 'react'

import { AlertTriangle, Trash2, CreditCard } from 'lucide-react'
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

import { deleteDugsiFamily, getDeleteFamilyPreview } from '../../actions'

interface DeleteFamilyDialogProps {
  studentId: string
  familyName: string
  hasActiveSubscription: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface DeletePreview {
  count: number
  students: Array<{ id: string; name: string; parentEmail: string | null }>
}

export function DeleteFamilyDialog({
  studentId,
  familyName,
  hasActiveSubscription,
  open,
  onOpenChange,
  onSuccess,
}: DeleteFamilyDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<DeletePreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  useEffect(() => {
    if (open && !preview) {
      setIsLoadingPreview(true)
      getDeleteFamilyPreview(studentId)
        .then((result) => {
          if (result.success && result.data) {
            setPreview(result.data)
          } else {
            setPreview({ count: 1, students: [] })
          }
        })
        .catch(() => {
          setPreview({ count: 1, students: [] })
        })
        .finally(() => {
          setIsLoadingPreview(false)
        })
    }
  }, [open, studentId, preview])

  useEffect(() => {
    if (!open) {
      setPreview(null)
    }
  }, [open])

  const handleDelete = async () => {
    startTransition(async () => {
      const result = await deleteDugsiFamily(studentId)
      if (result.success) {
        toast.success(result.message || 'Family deleted successfully')
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast.error(result.error || 'Failed to delete family')
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Delete Family
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete the{' '}
                <strong>{familyName}</strong> family?
              </p>

              <div className="min-h-[80px]">
                {isLoadingPreview && (
                  <p className="text-sm text-muted-foreground">
                    Loading family details...
                  </p>
                )}

                {!isLoadingPreview && preview && (
                  <div className="space-y-2">
                    <p className="text-sm">
                      This will delete{' '}
                      <strong>
                        {preview.count}{' '}
                        {preview.count === 1 ? 'student' : 'students'}
                      </strong>{' '}
                      and all associated program data.
                    </p>

                    {preview.students.length > 0 && (
                      <ul className="list-inside list-disc text-sm text-muted-foreground">
                        {preview.students.map((student) => (
                          <li key={student.id}>{student.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {hasActiveSubscription && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-amber-800">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Warning:</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-amber-700"
                    >
                      <CreditCard className="mr-1 h-3 w-3" />
                      Active subscription will be canceled
                    </Badge>
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
            disabled={isPending || isLoadingPreview}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? 'Deleting...' : 'Delete Family'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
