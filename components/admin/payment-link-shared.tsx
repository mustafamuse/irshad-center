'use client'

import {
  Check,
  Copy,
  DollarSign,
  ExternalLink,
  Loader2,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { getBillingDayOptions } from '@/lib/utils/billing-date'
import { normalizePhone } from '@/lib/utils/contact-normalization'

import { BillingPreview } from './billing-preview'

/**
 * Shared override amount input with switch toggle.
 * Used in both Mahad and Dugsi payment link dialogs.
 */
interface OverrideAmountInputProps {
  useOverride: boolean
  onUseOverrideChange: (checked: boolean) => void
  overrideAmount: string
  onOverrideAmountChange: (value: string) => void
  displayAmount?: number
  formatAmount: (cents: number) => string
}

export function OverrideAmountInput({
  useOverride,
  onUseOverrideChange,
  overrideAmount,
  onOverrideAmountChange,
  displayAmount,
  formatAmount,
}: OverrideAmountInputProps) {
  return (
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
          onCheckedChange={onUseOverrideChange}
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
              onChange={(e) => onOverrideAmountChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      )}

      {useOverride && displayAmount && displayAmount > 0 && (
        <Alert>
          <AlertDescription className="text-sm">
            Custom rate: <strong>{formatAmount(displayAmount)}</strong>
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}

/**
 * Shared billing start date selector.
 * Wraps the Select and BillingPreview components.
 */
interface BillingStartDateSelectProps {
  billingStartDay: string
  onBillingStartDayChange: (value: string) => void
}

export function BillingStartDateSelect({
  billingStartDay,
  onBillingStartDayChange,
}: BillingStartDateSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="billing-start-day">Billing Start Date</Label>
      <Select value={billingStartDay} onValueChange={onBillingStartDayChange}>
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
      <BillingPreview billingStartDay={billingStartDay} />
      {!billingStartDay && (
        <p className="text-xs text-muted-foreground">
          Leave empty to start billing immediately.
        </p>
      )}
    </div>
  )
}

/**
 * Shared payment link display with copy button.
 */
interface PaymentLinkDisplayProps {
  url: string
  copied: boolean
  onCopy: () => void
}

export function PaymentLinkDisplay({
  url,
  copied,
  onCopy,
}: PaymentLinkDisplayProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="payment-link">Payment Link</Label>
      <div className="flex gap-2">
        <Input
          id="payment-link"
          value={url}
          readOnly
          className="font-mono text-xs"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={onCopy}
          className="shrink-0"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="sr-only">{copied ? 'Copied' : 'Copy link'}</span>
        </Button>
      </div>
    </div>
  )
}

/**
 * Shared generate button.
 */
interface GenerateButtonProps {
  isPending: boolean
  onClick: () => void
}

export function GenerateButton({ isPending, onClick }: GenerateButtonProps) {
  return (
    <Button onClick={onClick} disabled={isPending} className="w-full">
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
  )
}

/**
 * Shared action buttons for after link generation.
 */
interface PaymentLinkActionsProps {
  url: string
  phone: string | null | undefined
  getWhatsAppMessage: (url: string) => string
  hasResult: boolean
  onClose: () => void
}

export function PaymentLinkActions({
  url,
  phone,
  getWhatsAppMessage,
  hasResult,
  onClose,
}: PaymentLinkActionsProps) {
  const handleOpenWhatsApp = () => {
    if (!url || !phone) {
      toast.error('No phone number available for WhatsApp')
      return
    }

    let phoneNumber = normalizePhone(phone) ?? ''
    if (phoneNumber.length === 10 && !phoneNumber.startsWith('1')) {
      phoneNumber = `1${phoneNumber}`
    }

    const message = encodeURIComponent(getWhatsAppMessage(url))
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank')
  }

  const handleOpenLink = () => {
    if (url) {
      window.open(url, '_blank')
    }
  }

  return (
    <>
      {hasResult && (
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
      <Button variant={hasResult ? 'default' : 'outline'} onClick={onClose}>
        {hasResult ? 'Done' : 'Cancel'}
      </Button>
    </>
  )
}

/**
 * Utility to copy URL to clipboard with toast feedback.
 */
export async function copyPaymentLink(
  url: string,
  setCopied: (copied: boolean) => void
) {
  try {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Payment link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  } catch {
    toast.error('Failed to copy link')
  }
}

/**
 * Standard error message for invalid override amounts.
 */
export const INVALID_OVERRIDE_ERROR = 'Please enter a valid override amount'

/**
 * Validate override amount from string input.
 * Returns cents if valid, undefined otherwise.
 */
export function validateOverrideInput(
  value: string,
  maxExpectedRate: number
): { cents: number | undefined; showWarning: boolean; error: string | null } {
  if (!value) {
    return { cents: undefined, showWarning: false, error: null }
  }

  const parsed = parseFloat(value)
  if (isNaN(parsed) || parsed <= 0 || !isFinite(parsed)) {
    return {
      cents: undefined,
      showWarning: false,
      error: INVALID_OVERRIDE_ERROR,
    }
  }

  const cents = Math.round(parsed * 100)
  const showWarning = cents > maxExpectedRate

  return { cents, showWarning, error: null }
}
