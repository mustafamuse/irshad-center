'use client'

import { useEffect, useState, useTransition } from 'react'

import Link from 'next/link'

import { Link2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  BillingStartDateSelect,
  copyPaymentLink,
  GenerateButton,
  OverrideAmountInput,
  PaymentLinkActions,
  PaymentLinkDisplay,
  validateOverrideInput,
} from '@/components/admin/payment-link-shared'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  getWhatsAppPaymentMessage,
  MAX_EXPECTED_MAHAD_RATE,
} from '@/lib/constants/mahad'
import {
  formatBillingDate,
  getNextBillingDate,
  parseBillingDay,
} from '@/lib/utils/billing-date'

import {
  generatePaymentLinkWithOverrideAction,
  type PaymentLinkWithOverrideResult,
} from '../../_actions'

interface PaymentLinkDialogProps {
  profileId: string
  studentName: string
  studentPhone?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  errorActionHref?: string
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function PaymentLinkDialog({
  profileId,
  studentName,
  studentPhone,
  open,
  onOpenChange,
  errorActionHref,
}: PaymentLinkDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<PaymentLinkWithOverrideResult | null>(
    null
  )
  const [copied, setCopied] = useState(false)
  const [useOverride, setUseOverride] = useState(false)
  const [overrideAmount, setOverrideAmount] = useState('')
  const [billingStartDay, setBillingStartDay] = useState('')
  const [selectedBillingDate, setSelectedBillingDate] = useState<string | null>(
    null
  )

  useEffect(() => {
    if (!open) {
      setResult(null)
      setCopied(false)
      setUseOverride(false)
      setOverrideAmount('')
      setBillingStartDay('')
      setSelectedBillingDate(null)
    }
  }, [open])

  const handleGenerateLink = () => {
    let overrideAmountCents: number | undefined
    if (useOverride && overrideAmount) {
      const validation = validateOverrideInput(
        overrideAmount,
        MAX_EXPECTED_MAHAD_RATE
      )
      if (validation.error) {
        toast.error(validation.error)
        return
      }
      overrideAmountCents = validation.cents
      if (validation.showWarning) {
        toast.warning('Amount exceeds typical max rate. Please verify.')
      }
    }

    const billingDayNum = parseBillingDay(billingStartDay)
    if (billingStartDay && billingDayNum === null) {
      toast.error('Invalid billing day selected')
      return
    }
    const billingDate = billingDayNum
      ? getNextBillingDate(billingDayNum)
      : undefined
    const billingDateISO = billingDate?.toISOString()

    startTransition(async () => {
      const response = await generatePaymentLinkWithOverrideAction({
        profileId,
        overrideAmount: overrideAmountCents,
        billingStartDate: billingDateISO,
      })

      if (response.success && response.url) {
        setResult(response)
        setSelectedBillingDate(billingDateISO || null)
        toast.success('Payment link generated successfully')
      } else {
        toast.error(response.error || 'Failed to generate payment link')
      }
    })
  }

  const displayOverrideAmount =
    useOverride && overrideAmount
      ? Math.round(parseFloat(overrideAmount || '0') * 100)
      : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Generate Payment Link
          </DialogTitle>
          <DialogDescription>
            Create a payment link for <strong>{studentName}</strong> based on
            their billing configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {result?.error && (
            <Alert variant="destructive">
              <AlertTitle>Cannot Generate Link</AlertTitle>
              <AlertDescription>
                {result.error}
                {errorActionHref && (
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href={errorActionHref}>Review billing details</Link>
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!result?.url && !result?.error && (
            <>
              <OverrideAmountInput
                useOverride={useOverride}
                onUseOverrideChange={setUseOverride}
                overrideAmount={overrideAmount}
                onOverrideAmountChange={setOverrideAmount}
                displayAmount={displayOverrideAmount}
                formatAmount={formatCurrency}
              />

              <BillingStartDateSelect
                billingStartDay={billingStartDay}
                onBillingStartDayChange={setBillingStartDay}
              />

              <GenerateButton
                isPending={isPending}
                onClick={handleGenerateLink}
              />
            </>
          )}

          {result?.url && (
            <>
              <div className="rounded-lg border bg-muted/50 p-4">
                <Label className="text-xs text-muted-foreground">
                  {result.isOverride ? 'Custom Rate' : 'Calculated Rate'}
                </Label>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(result.finalAmount || 0)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {result.billingPeriod}
                  </span>
                </p>
                {result.isOverride && result.calculatedAmount && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Original: {formatCurrency(result.calculatedAmount)}
                  </p>
                )}
                {selectedBillingDate && (
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    Billing starts:{' '}
                    <span className="text-foreground">
                      {formatBillingDate(new Date(selectedBillingDate))}
                    </span>
                  </p>
                )}
              </div>

              <PaymentLinkDisplay
                url={result.url}
                copied={copied}
                onCopy={() => copyPaymentLink(result.url!, setCopied)}
              />

              <Alert>
                <AlertDescription className="text-sm">
                  Send this link to the student via WhatsApp or copy to
                  clipboard. The link expires in 24 hours.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <PaymentLinkActions
            url={result?.url || ''}
            phone={result?.studentPhone || studentPhone}
            getWhatsAppMessage={getWhatsAppPaymentMessage}
            hasResult={!!result?.url}
            onClose={() => onOpenChange(false)}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
