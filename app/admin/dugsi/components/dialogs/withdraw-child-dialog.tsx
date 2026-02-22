'use client'

import { useCallback, useEffect, useState } from 'react'

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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import type { WithdrawPreview } from '@/lib/services/dugsi/withdrawal-service'
import { formatRate } from '@/lib/utils/dugsi-tuition'

import { WithdrawalReasonForm } from './withdrawal-reason-form'
import { useActionHandler } from '../../_hooks/use-action-handler'
import { usePreviewDialog } from '../../_hooks/use-preview-dialog'
import {
  getWithdrawChildPreviewAction,
  withdrawChildAction,
} from '../../actions'

interface WithdrawChildDialogProps {
  studentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function WithdrawChildDialog({
  studentId,
  open,
  onOpenChange,
  onSuccess,
}: WithdrawChildDialogProps) {
  const fetchPreview = useCallback(
    () => getWithdrawChildPreviewAction({ studentId }),
    [studentId]
  )
  const {
    preview,
    isLoading: isLoadingPreview,
    error: previewError,
  } = usePreviewDialog<WithdrawPreview>({ open, fetchPreview })

  const [reason, setReason] = useState<string>('')
  const [reasonNote, setReasonNote] = useState('')
  const [billingType, setBillingType] = useState<
    'auto_recalculate' | 'cancel_subscription'
  >('auto_recalculate')

  useEffect(() => {
    if (!open) {
      setReason('')
      setReasonNote('')
      setBillingType('auto_recalculate')
    }
  }, [open])

  const { execute: executeWithdraw, isPending } = useActionHandler(
    withdrawChildAction,
    {
      onSuccess: () => {
        onOpenChange(false)
        onSuccess?.()
      },
    }
  )

  const handleSubmit = () => {
    if (!reason) return

    const billingAdjustment =
      preview?.isLastActiveChild && billingType === 'cancel_subscription'
        ? { type: 'cancel_subscription' as const }
        : { type: 'auto_recalculate' as const }

    executeWithdraw({
      studentId,
      reason,
      reasonNote: reasonNote || undefined,
      billingAdjustment,
    })
  }

  const remainingChildren = preview ? preview.activeChildrenCount - 1 : 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Withdraw Child
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {isLoadingPreview && (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-full" />
                </div>
              )}

              {!isLoadingPreview && previewError && (
                <p className="text-sm text-red-600">{previewError}</p>
              )}

              {!isLoadingPreview && preview && (
                <>
                  <p>
                    Are you sure you want to withdraw{' '}
                    <strong>{preview.childName}</strong> from the Dugsi program?
                  </p>

                  <div className="space-y-3">
                    <WithdrawalReasonForm
                      reason={reason}
                      reasonNote={reasonNote}
                      onReasonChange={setReason}
                      onReasonNoteChange={setReasonNote}
                    />

                    {preview.hasActiveSubscription &&
                      !preview.isLastActiveChild && (
                        <p className="text-sm text-muted-foreground">
                          Billing will be auto-recalculated to{' '}
                          {formatRate(preview.recalculatedAmount)}/mo for{' '}
                          {remainingChildren}{' '}
                          {remainingChildren === 1 ? 'child' : 'children'}.
                        </p>
                      )}

                    {preview.hasActiveSubscription &&
                      preview.isLastActiveChild && (
                        <div className="space-y-2">
                          <Label>Billing adjustment</Label>
                          <RadioGroup
                            value={billingType}
                            onValueChange={(v) =>
                              setBillingType(
                                v as 'auto_recalculate' | 'cancel_subscription'
                              )
                            }
                            className="space-y-2"
                          >
                            <div className="flex items-start space-x-2">
                              <RadioGroupItem
                                value="auto_recalculate"
                                id="auto_recalculate"
                              />
                              <div className="grid gap-0.5">
                                <Label
                                  htmlFor="auto_recalculate"
                                  className="font-normal"
                                >
                                  Auto-recalculate
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Subscription will be canceled (no remaining
                                  children)
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start space-x-2">
                              <RadioGroupItem
                                value="cancel_subscription"
                                id="cancel_subscription"
                              />
                              <div className="grid gap-0.5">
                                <Label
                                  htmlFor="cancel_subscription"
                                  className="font-normal"
                                >
                                  Cancel subscription
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Last active child - cancel the subscription
                                  entirely
                                </p>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                      )}
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={isPending || isLoadingPreview || !reason || !preview}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? 'Withdrawing...' : 'Withdraw'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
