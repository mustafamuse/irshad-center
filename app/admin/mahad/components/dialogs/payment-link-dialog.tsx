'use client'

import { useEffect, useState, useTransition } from 'react'

import Link from 'next/link'

import {
  Check,
  Copy,
  DollarSign,
  ExternalLink,
  Link2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

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
import {
  getWhatsAppPaymentMessage,
  MAX_EXPECTED_MAHAD_RATE,
} from '@/lib/constants/mahad'
import {
  formatBillingDate,
  getBillingDayOptions,
  getNextBillingDate,
} from '@/lib/utils/billing-date'
import { normalizePhone } from '@/lib/utils/contact-normalization'

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
      const parsed = parseFloat(overrideAmount)
      if (isNaN(parsed) || parsed <= 0) {
        toast.error('Please enter a valid override amount')
        return
      }
      overrideAmountCents = Math.round(parsed * 100)

      if (overrideAmountCents > MAX_EXPECTED_MAHAD_RATE) {
        toast.warning('Amount exceeds typical max rate. Please verify.')
      }
    }

    const billingDate = billingStartDay
      ? getNextBillingDate(parseInt(billingStartDay))
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

  const handleCopy = async () => {
    if (!result?.url) return

    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      toast.success('Payment link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleOpenWhatsApp = () => {
    if (!result?.url) return

    const phone = result.studentPhone || studentPhone
    if (!phone) {
      toast.error('No phone number available for WhatsApp')
      return
    }

    let phoneNumber = normalizePhone(phone) ?? ''
    if (phoneNumber.length === 10 && !phoneNumber.startsWith('1')) {
      phoneNumber = `1${phoneNumber}`
    }

    const message = encodeURIComponent(getWhatsAppPaymentMessage(result.url))
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank')
  }

  const handleOpenLink = () => {
    if (result?.url) {
      window.open(result.url, '_blank')
    }
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

              {useOverride && displayOverrideAmount && (
                <Alert>
                  <AlertDescription className="text-sm">
                    Custom rate:{' '}
                    <strong>{formatCurrency(displayOverrideAmount)}</strong>
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
                {billingStartDay && (
                  <p className="text-sm text-muted-foreground">
                    Billing will start:{' '}
                    <span className="font-medium text-foreground">
                      {formatBillingDate(
                        getNextBillingDate(parseInt(billingStartDay))
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
                    value={result.url}
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
                  Send this link to the student via WhatsApp or copy to
                  clipboard. The link expires in 24 hours.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {result?.url && (
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
            variant={result?.url ? 'default' : 'outline'}
            onClick={() => onOpenChange(false)}
          >
            {result?.url ? 'Done' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
