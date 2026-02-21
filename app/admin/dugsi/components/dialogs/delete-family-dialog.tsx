'use client'

import { useEffect, useState } from 'react'

import { AlertTriangle, CreditCard } from 'lucide-react'

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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { WITHDRAWAL_REASONS } from '@/lib/constants/dugsi'

import { useActionHandler } from '../../_hooks/use-action-handler'
import {
  getDeleteFamilyPreview,
  withdrawAllChildrenAction,
} from '../../actions'

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
  const [preview, setPreview] = useState<DeletePreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [reason, setReason] = useState<string>('')
  const [reasonNote, setReasonNote] = useState('')

  const { execute: executeWithdrawAll, isPending } = useActionHandler(
    withdrawAllChildrenAction,
    {
      onSuccess: () => {
        onOpenChange(false)
        onSuccess?.()
      },
    }
  )

  useEffect(() => {
    if (open && !preview) {
      setIsLoadingPreview(true)
      setPreviewError(null)
      getDeleteFamilyPreview(studentId)
        .then((result) => {
          if (result.success && result.data) {
            setPreview(result.data)
          } else {
            setPreviewError(result.error ?? 'Failed to load preview')
          }
        })
        .catch((err: Error) => {
          setPreviewError(err.message || 'Failed to load preview')
        })
        .finally(() => {
          setIsLoadingPreview(false)
        })
    }
  }, [open, studentId, preview])

  useEffect(() => {
    if (!open) {
      setPreview(null)
      setPreviewError(null)
      setReason('')
      setReasonNote('')
    }
  }, [open])

  const handleSubmit = () => {
    if (!reason) return

    executeWithdrawAll({
      studentId,
      reason,
      reasonNote: reasonNote || undefined,
      billingAdjustment: { type: 'cancel_subscription' },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Withdraw All Children
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will withdraw all active children from the{' '}
                <strong>{familyName}</strong> family. Their data will be
                preserved.
              </p>

              <div className="min-h-[60px]">
                {isLoadingPreview && (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                )}

                {!isLoadingPreview && previewError && (
                  <p className="text-sm text-red-600">{previewError}</p>
                )}

                {!isLoadingPreview && preview && (
                  <div className="space-y-2">
                    <p className="text-sm">
                      <strong>
                        {preview.count}{' '}
                        {preview.count === 1 ? 'child' : 'children'}
                      </strong>{' '}
                      will be withdrawn.
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
                  <div className="mt-3">
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-amber-700"
                    >
                      <CreditCard className="mr-1 h-3 w-3" />
                      Subscription will be canceled
                    </Badge>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {WITHDRAWAL_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {reason && (
                  <div className="space-y-1.5">
                    <Label>Note (optional)</Label>
                    <Textarea
                      value={reasonNote}
                      onChange={(e) => setReasonNote(e.target.value)}
                      placeholder="Additional details..."
                      rows={2}
                    />
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Children can be re-enrolled later.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={
              isPending || isLoadingPreview || !reason || !!previewError
            }
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? 'Withdrawing...' : 'Withdraw All'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
