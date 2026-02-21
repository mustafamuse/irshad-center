'use client'

import { useCallback, useEffect, useState } from 'react'

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
import { usePreviewDialog } from '../../_hooks/use-preview-dialog'
import {
  getWithdrawFamilyPreviewAction,
  withdrawAllFamilyChildrenAction,
} from '../../actions'

interface WithdrawFamilyDialogProps {
  familyReferenceId: string
  familyName: string
  hasActiveSubscription: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface WithdrawFamilyPreview {
  count: number
  students: Array<{ id: string; name: string }>
}

export function WithdrawFamilyDialog({
  familyReferenceId,
  familyName,
  hasActiveSubscription,
  open,
  onOpenChange,
  onSuccess,
}: WithdrawFamilyDialogProps) {
  const fetchPreview = useCallback(
    () => getWithdrawFamilyPreviewAction({ familyReferenceId }),
    [familyReferenceId]
  )
  const {
    preview,
    isLoading: isLoadingPreview,
    error: previewError,
  } = usePreviewDialog<WithdrawFamilyPreview>({ open, fetchPreview })

  const [reason, setReason] = useState<string>('')
  const [reasonNote, setReasonNote] = useState('')

  useEffect(() => {
    if (!open) {
      setReason('')
      setReasonNote('')
    }
  }, [open])

  const { execute: executeWithdrawAll, isPending } = useActionHandler(
    withdrawAllFamilyChildrenAction,
    {
      onSuccess: () => {
        onOpenChange(false)
        onSuccess?.()
      },
    }
  )

  const handleSubmit = () => {
    if (!reason) return

    executeWithdrawAll({
      familyReferenceId,
      reason,
      reasonNote: reasonNote || undefined,
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
