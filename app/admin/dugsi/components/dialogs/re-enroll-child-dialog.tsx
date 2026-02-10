'use client'

import { useEffect, useState } from 'react'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

import { useActionHandler } from '../../_hooks/use-action-handler'
import { reEnrollChildAction } from '../../actions'

interface ReEnrollChildDialogProps {
  studentId: string
  childName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type BillingType = 'auto_recalculate' | 'keep_current' | 'custom'

export function ReEnrollChildDialog({
  studentId,
  childName,
  open,
  onOpenChange,
  onSuccess,
}: ReEnrollChildDialogProps) {
  const [billingType, setBillingType] =
    useState<BillingType>('auto_recalculate')
  const [customAmount, setCustomAmount] = useState('')

  const { execute: executeReEnroll, isPending } = useActionHandler(
    reEnrollChildAction,
    {
      onSuccess: () => {
        onOpenChange(false)
        onSuccess?.()
      },
    }
  )

  useEffect(() => {
    if (!open) {
      setBillingType('auto_recalculate')
      setCustomAmount('')
    }
  }, [open])

  const handleSubmit = () => {
    let billingAdjustment:
      | { type: 'auto_recalculate' }
      | { type: 'keep_current' }
      | { type: 'custom'; amount: number }

    if (billingType === 'custom') {
      const dollars = parseFloat(customAmount)
      if (isNaN(dollars) || dollars <= 0) return
      billingAdjustment = { type: 'custom', amount: Math.round(dollars * 100) }
    } else {
      billingAdjustment = { type: billingType }
    }

    executeReEnroll({ studentId, billingAdjustment })
  }

  const isCustomInvalid =
    billingType === 'custom' &&
    (customAmount === '' ||
      isNaN(parseFloat(customAmount)) ||
      parseFloat(customAmount) <= 0)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Re-enroll Child</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Re-enroll <strong>{childName}</strong> in the Dugsi program?
              </p>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Billing adjustment
                </p>
                <RadioGroup
                  value={billingType}
                  onValueChange={(v) => setBillingType(v as BillingType)}
                  className="space-y-2"
                >
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="auto_recalculate" id="re-auto" />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="re-auto" className="font-medium">
                        Auto-recalculate
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Rate will be recalculated based on total active children
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="keep_current" id="re-keep" />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="re-keep" className="font-medium">
                        Keep current
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Keep the current billing amount unchanged
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="custom" id="re-custom" />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="re-custom" className="font-medium">
                        Custom amount
                      </Label>
                      {billingType === 'custom' && (
                        <div className="mt-1.5">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            className="h-8 w-32"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={isPending || isCustomInvalid}
          >
            {isPending ? 'Re-enrolling...' : 'Re-enroll'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
