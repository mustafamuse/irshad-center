'use client'

import { useEffect, useState } from 'react'

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
import type { WithdrawPreview } from '@/lib/services/dugsi/withdrawal-service'
import { formatRate } from '@/lib/utils/dugsi-tuition'

import { useActionHandler } from '../../_hooks/use-action-handler'
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
  const [preview, setPreview] = useState<WithdrawPreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [reason, setReason] = useState<string>('')
  const [reasonNote, setReasonNote] = useState('')
  const [billingType, setBillingType] = useState<string>('auto_recalculate')

  const { execute: executeWithdraw, isPending } = useActionHandler(
    withdrawChildAction,
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
      getWithdrawChildPreviewAction({ studentId })
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
        .finally(() => setIsLoadingPreview(false))
    }
  }, [open, studentId, preview])

  useEffect(() => {
    if (!open) {
      setPreview(null)
      setPreviewError(null)
      setReason('')
      setReasonNote('')
      setBillingType('auto_recalculate')
    }
  }, [open])

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
                            onValueChange={setBillingType}
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
