'use client'

/**
 * Payment Link Dialog
 *
 * Allows admins to generate a Stripe checkout payment link for a student.
 * The link uses the saved billing configuration (graduation status, payment frequency, billing type).
 *
 * Features:
 * - Shows calculated amount before generating
 * - Generates Stripe checkout session URL
 * - Copy to clipboard functionality
 * - Error handling for incomplete billing config
 */

import { useEffect, useState, useTransition } from 'react'

import Link from 'next/link'

import { Check, Copy, ExternalLink, Link2, Loader2 } from 'lucide-react'
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
  generatePaymentLinkAction,
  type PaymentLinkResult,
} from '../../_actions'

interface PaymentLinkDialogProps {
  profileId: string
  studentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  generateLink?: (profileId: string) => Promise<PaymentLinkResult>
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
  open,
  onOpenChange,
  generateLink,
  errorActionHref,
}: PaymentLinkDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{
    url?: string
    amount?: number
    billingPeriod?: string
    error?: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const generateLinkFn = generateLink ?? generatePaymentLinkAction

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setResult(null)
      setCopied(false)
    }
  }, [open])

  const handleGenerateLink = () => {
    startTransition(async () => {
      const response = await generateLinkFn(profileId)
      if (response.success) {
        setResult({
          url: response.url,
          amount: response.amount,
          billingPeriod: response.billingPeriod,
        })
        toast.success('Payment link generated successfully')
      } else {
        toast.error(response.error || 'Failed to generate payment link')
        setResult({
          error: response.error || 'Unable to generate payment link',
        })
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

  const handleOpenLink = () => {
    if (result?.url) {
      window.open(result.url, '_blank')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Payment Link
          </DialogTitle>
          <DialogDescription>
            Generate a payment link for <strong>{studentName}</strong> based on
            their billing configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error State */}
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

          {/* Initial State - Show Generate Button */}
          {!result && (
            <div className="py-4 text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                Click below to generate a payment link using the student&apos;s
                current billing configuration.
              </p>
              <Button onClick={handleGenerateLink} disabled={isPending}>
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
            </div>
          )}

          {/* Success State - Show Link */}
          {result?.url && (
            <>
              {/* Amount Display */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <Label className="text-xs text-muted-foreground">
                  Calculated Amount
                </Label>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(result.amount || 0)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {result.billingPeriod}
                  </span>
                </p>
              </div>

              {/* Payment Link */}
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

              {/* Instructions */}
              <Alert>
                <AlertDescription className="text-sm">
                  Copy this link and send it to the student via WhatsApp, SMS,
                  or email. The link expires in 24 hours.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {result?.url && (
            <Button variant="outline" onClick={handleOpenLink}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Link
            </Button>
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
