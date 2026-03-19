'use client'

import { useEffect, useState, useTransition } from 'react'

import { AlertTriangle, UserMinus, ArrowRight } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { formatRate } from '@/lib/utils/dugsi-tuition'

import {
  getWithdrawalPreviewAction,
  withdrawChildrenAction,
} from '../../withdrawal-actions'

interface WithdrawalPreviewData {
  childrenToWithdraw: Array<{ id: string; name: string }>
  currentRate: number
  newRate: number
  remainingCount: number
  removesAllChildren: boolean
  subscriptionStatus: string | null
  hasOverride: boolean
}

interface WithdrawDialogProps {
  familyReferenceId: string
  profileIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function WithdrawDialog({
  familyReferenceId,
  profileIds,
  open,
  onOpenChange,
  onSuccess,
}: WithdrawDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<WithdrawalPreviewData | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  useEffect(() => {
    if (open && profileIds.length > 0) {
      setIsLoadingPreview(true)
      getWithdrawalPreviewAction(familyReferenceId, profileIds)
        .then((result) => {
          if (result.success && result.data) {
            setPreview(result.data)
          } else {
            toast.error(result.error || 'Failed to load preview')
            onOpenChange(false)
          }
        })
        .catch(() => {
          toast.error('Failed to load withdrawal preview')
          onOpenChange(false)
        })
        .finally(() => {
          setIsLoadingPreview(false)
        })
    }
  }, [open, familyReferenceId, profileIds, onOpenChange])

  useEffect(() => {
    if (!open) {
      setPreview(null)
    }
  }, [open])

  const handleWithdraw = () => {
    startTransition(async () => {
      const result = await withdrawChildrenAction(familyReferenceId, profileIds)
      if (result.success) {
        toast.success(result.message || 'Children withdrawn')
        if (result.warning) {
          toast.warning(result.warning)
        }
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast.error(result.error || 'Failed to withdraw children')
      }
    })
  }

  const isPaused = preview?.subscriptionStatus === 'paused'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-amber-500" />
            Withdraw{' '}
            {preview?.childrenToWithdraw.length === 1 ? 'Child' : 'Children'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="min-h-[60px]">
                {isLoadingPreview && (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                )}

                {!isLoadingPreview && preview && (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-sm font-medium text-foreground">
                        Withdrawing:
                      </p>
                      <ul className="list-inside list-disc text-sm text-muted-foreground">
                        {preview.childrenToWithdraw.map((child) => (
                          <li key={child.id}>{child.name}</li>
                        ))}
                      </ul>
                    </div>

                    {preview.subscriptionStatus && (
                      <div className="rounded-md border bg-muted/30 p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Rate</span>
                          <div className="flex items-center gap-2">
                            <span className="line-through">
                              {formatRate(preview.currentRate)}/mo
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-semibold text-foreground">
                              {preview.removesAllChildren
                                ? 'Canceled'
                                : `${formatRate(preview.newRate)}/mo`}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Remaining children
                          </span>
                          <span className="font-medium text-foreground">
                            {preview.remainingCount}
                          </span>
                        </div>
                      </div>
                    )}

                    {preview.removesAllChildren && (
                      <div className="flex items-center gap-2 text-sm text-amber-700">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Subscription will be canceled at end of billing period
                      </div>
                    )}

                    {preview.hasOverride && (
                      <div className="flex items-center gap-2 text-sm text-amber-700">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Admin override will be reset to calculated rate
                      </div>
                    )}

                    {isPaused && (
                      <Badge variant="outline" className="text-xs">
                        Subscription is paused - DB only, no Stripe changes
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleWithdraw}
            disabled={isPending || isLoadingPreview}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isPending ? 'Withdrawing...' : 'Confirm Withdrawal'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
