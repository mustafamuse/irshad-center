'use client'

import { useEffect, useState, useTransition } from 'react'

import {
  Check,
  Copy,
  DollarSign,
  ExternalLink,
  Link2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getWhatsAppPaymentMessage } from '@/lib/constants/dugsi'
import {
  formatBillingDate,
  getBillingDayOptions,
  getNextBillingDate,
  parseBillingDay,
} from '@/lib/utils/billing-date'
import { normalizePhone } from '@/lib/utils/contact-normalization'
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
      const parsed = parseFloat(overrideAmount)
      if (isNaN(parsed) || parsed <= 0) {
        toast.error('Please enter a valid override amount')
        return
      }
      overrideAmountCents = Math.round(parsed * 100)

      if (overrideAmountCents > MAX_EXPECTED_FAMILY_RATE) {
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
      const response = await generateFamilyPaymentLinkAction({
        familyId,
        childCount,
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

  const handleCopy = async () => {
    if (!result?.paymentUrl) return

    try {
      await navigator.clipboard.writeText(result.paymentUrl)
      setCopied(true)
      toast.success('Payment link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleOpenWhatsApp = () => {
    if (!result?.paymentUrl) return

    const parentPhone = family.parentPhone || family.members[0]?.parentPhone
    if (!parentPhone) {
      toast.error('No phone number available for WhatsApp')
      return
    }

    let phoneNumber = normalizePhone(parentPhone) ?? ''
    if (phoneNumber.length === 10 && !phoneNumber.startsWith('1')) {
      phoneNumber = `1${phoneNumber}`
    }

    const message = encodeURIComponent(
      getWhatsAppPaymentMessage(result.paymentUrl)
    )

    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank')
  }

  const handleOpenLink = () => {
    if (result?.paymentUrl) {
      window.open(result.paymentUrl, '_blank')
    }
  }

  const displayRate =
    useOverride && overrideAmount
      ? Math.round(parseFloat(overrideAmount || '0') * 100)
      : calculatedRate

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

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="use-override" className="text-sm font-medium">
                    Use Custom Rate
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Override the calculated rate
                  </p>
                </div>
                <Switch
                  id="use-override"
                  checked={useOverride}
                  onCheckedChange={setUseOverride}
                />
              </div>

              {useOverride && (
                <div className="space-y-2">
                  <Label htmlFor="override-amount">Custom Amount (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="override-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={overrideAmount}
                      onChange={(e) => setOverrideAmount(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              {useOverride && overrideAmount && (
                <Alert>
                  <AlertDescription className="text-sm">
                    Final rate: <strong>{formatRate(displayRate)}/month</strong>
                    {displayRate !== calculatedRate && (
                      <span className="text-muted-foreground">
                        {' '}
                        (was {formatRate(calculatedRate)})
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="billing-start-day">Billing Start Date</Label>
                <Select
                  value={billingStartDay}
                  onValueChange={setBillingStartDay}
                >
                  <SelectTrigger id="billing-start-day">
                    <SelectValue placeholder="Start immediately (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    {getBillingDayOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {parseBillingDay(billingStartDay) && (
                  <p className="text-sm text-muted-foreground">
                    Billing will start:{' '}
                    <span className="font-medium text-foreground">
                      {formatBillingDate(
                        getNextBillingDate(parseBillingDay(billingStartDay)!)
                      )}
                    </span>
                  </p>
                )}
                {!billingStartDay && (
                  <p className="text-xs text-muted-foreground">
                    Leave empty to start billing immediately.
                  </p>
                )}
              </div>

              <Button
                onClick={handleGenerateLink}
                disabled={isPending}
                className="w-full"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Generate Payment Link
                  </>
                )}
              </Button>
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
                      {new Date(selectedBillingDate).toLocaleDateString(
                        'en-US',
                        {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        }
                      )}
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-link">Payment Link</Label>
                <div className="flex gap-2">
                  <Input
                    id="payment-link"
                    value={result.paymentUrl}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {copied ? 'Copied' : 'Copy link'}
                    </span>
                  </Button>
                </div>
              </div>

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
          {result && (
            <>
              <Button variant="outline" onClick={handleOpenWhatsApp}>
                Send via WhatsApp
              </Button>
              <Button variant="outline" onClick={handleOpenLink}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Link
              </Button>
            </>
          )}
          <Button
            variant={result ? 'default' : 'outline'}
            onClick={() => onOpenChange(false)}
          >
            {result ? 'Done' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
