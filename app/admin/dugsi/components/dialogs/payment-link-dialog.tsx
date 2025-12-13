'use client'

import { useEffect, useState, useTransition } from 'react'

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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { getWhatsAppPaymentMessage } from '@/lib/constants/dugsi'
import {
  formatBillingDate,
  getNextBillingDate,
  parseBillingDay,
} from '@/lib/utils/billing-date'
import {
  calculateDugsiRate,
  formatRate,
  getRateTierDescription,
  MAX_EXPECTED_FAMILY_RATE,
} from '@/lib/utils/dugsi-tuition'

import { Family } from '../../_types'
import {
  generateFamilyPaymentLinkAction,
  type FamilyPaymentLinkData,
} from '../../actions'

interface PaymentLinkDialogProps {
  family: Family
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentLinkDialog({
  family,
  open,
  onOpenChange,
}: PaymentLinkDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<FamilyPaymentLinkData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [useOverride, setUseOverride] = useState(false)
  const [overrideAmount, setOverrideAmount] = useState('')
  const [billingStartDay, setBillingStartDay] = useState('')
  const [selectedBillingDate, setSelectedBillingDate] = useState<string | null>(
    null
  )

  const childCount = family.members.length
  const calculatedRate = calculateDugsiRate(childCount)
  const tierDescription = getRateTierDescription(childCount)
  const familyId = family.members[0]?.familyReferenceId

  useEffect(() => {
    if (!open) {
      setResult(null)
      setError(null)
      setCopied(false)
      setUseOverride(false)
      setOverrideAmount('')
      setBillingStartDay('')
      setSelectedBillingDate(null)
    }
  }, [open])

  const handleGenerateLink = () => {
    if (!familyId) {
      toast.error('Family reference ID not found')
      return
    }

    let overrideAmountCents: number | undefined
    if (useOverride && overrideAmount) {
      const validation = validateOverrideInput(
        overrideAmount,
        MAX_EXPECTED_FAMILY_RATE
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
      // Note: childCount is NOT passed - service queries DB for authoritative count
      const response = await generateFamilyPaymentLinkAction({
        familyId,
        overrideAmount: overrideAmountCents,
        billingStartDate: billingDateISO,
      })

      if (response.success && response.data) {
        setResult(response.data)
        setError(null)
        setSelectedBillingDate(billingDateISO || null)
        toast.success('Payment link generated successfully')
      } else {
        setError(response.error || 'Failed to generate payment link')
        toast.error(response.error || 'Failed to generate payment link')
      }
    })
  }

  const displayRate =
    useOverride && overrideAmount
      ? Math.round(parseFloat(overrideAmount || '0') * 100)
      : calculatedRate

  const member = family.members[0]
  const primaryPayerPhone =
    member?.primaryPayerParentNumber === 2
      ? member.parent2Phone || member.parentPhone
      : member?.parentPhone || member?.parent2Phone
  const parentPhone = primaryPayerPhone || family.parentPhone

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Generate Payment Link
          </DialogTitle>
          <DialogDescription>
            Create a payment link for the{' '}
            <strong>{family.members[0]?.parentFirstName || 'Unknown'}</strong>{' '}
            family ({childCount} {childCount === 1 ? 'child' : 'children'}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!result && (
            <>
              <div className="rounded-lg border bg-muted/50 p-4">
                <Label className="text-xs text-muted-foreground">
                  Calculated Rate
                </Label>
                <p className="text-2xl font-bold text-primary">
                  {formatRate(calculatedRate)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /month
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tierDescription}
                </p>
              </div>

              <OverrideAmountInput
                useOverride={useOverride}
                onUseOverrideChange={setUseOverride}
                overrideAmount={overrideAmount}
                onOverrideAmountChange={setOverrideAmount}
                displayAmount={
                  useOverride && overrideAmount ? displayRate : undefined
                }
                formatAmount={(cents) => `${formatRate(cents)}/month`}
              />

              {useOverride &&
                overrideAmount &&
                displayRate !== calculatedRate && (
                  <Alert>
                    <AlertDescription className="text-sm">
                      Final rate:{' '}
                      <strong>{formatRate(displayRate)}/month</strong>
                      <span className="text-muted-foreground">
                        {' '}
                        (was {formatRate(calculatedRate)})
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

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

          {result && (
            <>
              <div className="rounded-lg border bg-muted/50 p-4">
                <Label className="text-xs text-muted-foreground">
                  {result.isOverride ? 'Custom Rate' : 'Calculated Rate'}
                </Label>
                <p className="text-2xl font-bold text-primary">
                  {result.rateDescription}
                  <span className="text-sm font-normal text-muted-foreground">
                    /month
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {result.tierDescription}
                </p>
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
                url={result.paymentUrl}
                copied={copied}
                onCopy={() => copyPaymentLink(result.paymentUrl, setCopied)}
              />

              <Alert>
                <AlertDescription className="text-sm">
                  Send this link to the parent via WhatsApp or copy to
                  clipboard. The link expires in 24 hours.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <PaymentLinkActions
            url={result?.paymentUrl || ''}
            phone={parentPhone}
            getWhatsAppMessage={getWhatsAppPaymentMessage}
            hasResult={!!result}
            onClose={() => onOpenChange(false)}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
