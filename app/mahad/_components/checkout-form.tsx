'use client'

/**
 * Mahad Checkout Form
 *
 * Custom checkout form that calculates tuition based on:
 * - Graduation status (still in school vs. graduated)
 * - Payment frequency (monthly vs. bi-monthly)
 *
 * Billing type is always FULL_TIME at checkout - admin adjusts afterward if needed.
 *
 * Replaces the Stripe Pricing Table for dynamic pricing.
 */

import { useState, useMemo } from 'react'

import type { GraduationStatus, PaymentFrequency } from '@prisma/client'
import {
  Loader2,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Shield,
  Mail,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { BASE_RATES } from '@/lib/utils/mahad-tuition'

// Client-side rate calculation using shared BASE_RATES from lib/utils/mahad-tuition
// All students default to FULL_TIME - admin adjusts billing type afterward if needed
function calculateRate(
  graduationStatus: GraduationStatus,
  paymentFrequency: PaymentFrequency
): number {
  const baseRate = BASE_RATES[graduationStatus][paymentFrequency]

  // For bi-monthly, return total for 2 months
  if (paymentFrequency === 'BI_MONTHLY') {
    return baseRate * 2
  }

  return baseRate
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

interface CheckoutFormProps {
  profileId: string
  studentName: string
}

export function CheckoutForm({ profileId, studentName }: CheckoutFormProps) {
  const [graduationStatus, setGraduationStatus] =
    useState<GraduationStatus>('NON_GRADUATE')
  const [paymentFrequency, setPaymentFrequency] =
    useState<PaymentFrequency>('MONTHLY')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBannerOpen, setIsBannerOpen] = useState(false)

  // Calculate the rate based on selections (always FULL_TIME)
  const calculatedRate = useMemo(() => {
    return calculateRate(graduationStatus, paymentFrequency)
  }, [graduationStatus, paymentFrequency])

  // Format the billing period text
  const billingPeriodText =
    paymentFrequency === 'MONTHLY' ? '/month' : '/2 months'

  // Calculate monthly equivalent for bi-monthly display
  const monthlyEquivalent = useMemo(() => {
    return BASE_RATES[graduationStatus][paymentFrequency]
  }, [graduationStatus, paymentFrequency])

  // Handle checkout - always uses FULL_TIME billing type
  // Admin can adjust billing type afterward if needed
  const handleCheckout = async () => {
    setIsLoading(true)
    setError(null)

    // Create abort controller with 30 second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch('/api/mahad/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          graduationStatus,
          paymentFrequency,
          // billingType is always FULL_TIME - admin adjusts if needed
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Informational Banner */}
      <Collapsible open={isBannerOpen} onOpenChange={setIsBannerOpen}>
        <Alert className="border-[#007078]/20 bg-[#007078]/5">
          <CollapsibleTrigger asChild>
            <button
              className="flex w-full items-center justify-between text-left"
              aria-label={
                isBannerOpen
                  ? 'Hide registration information'
                  : 'Show registration information'
              }
            >
              <h3 className="font-semibold text-[#007078]">
                Important Registration Information
              </h3>
              {isBannerOpen ? (
                <ChevronUp className="h-4 w-4 text-[#007078]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#007078]" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#007078]" />
                <span>
                  Students will be added to the attendance list once auto-pay is
                  confirmed
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#007078]" />
                <span>Secure payment processing through Stripe</span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#007078]" />
                <span>
                  You'll receive email confirmation once setup is complete
                </span>
              </li>
            </ul>
          </CollapsibleContent>
        </Alert>
      </Collapsible>

      {/* Student Info */}
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight text-gray-900">
          Set Up Your Payment Plan
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Setting up payment for{' '}
          <span className="font-semibold text-gray-900">{studentName}</span>
        </p>
      </div>

      {/* Graduation Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-4 w-4" />
            Education Status
          </CardTitle>
          <CardDescription className="text-xs">
            Have you completed your formal education?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={graduationStatus}
            onValueChange={(v) => setGraduationStatus(v as GraduationStatus)}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            <div>
              <RadioGroupItem
                value="NON_GRADUATE"
                id="non-graduate"
                className="peer sr-only"
              />
              <Label
                htmlFor="non-graduate"
                className="flex cursor-pointer flex-col items-center justify-between rounded-lg border-2 border-muted bg-card p-3 transition-all hover:border-[#007078]/50 hover:bg-accent hover:shadow-md peer-data-[state=checked]:border-[#007078] peer-data-[state=checked]:bg-[#007078]/5 peer-data-[state=checked]:shadow-sm [&:has([data-state=checked])]:border-[#007078] [&:has([data-state=checked])]:bg-[#007078]/5"
              >
                <span className="text-sm font-semibold">Still in School</span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {formatCurrency(BASE_RATES.NON_GRADUATE.MONTHLY)}/month base
                </span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="GRADUATE"
                id="graduate"
                className="peer sr-only"
              />
              <Label
                htmlFor="graduate"
                className="flex cursor-pointer flex-col items-center justify-between rounded-lg border-2 border-muted bg-card p-3 transition-all hover:border-[#007078]/50 hover:bg-accent hover:shadow-md peer-data-[state=checked]:border-[#007078] peer-data-[state=checked]:bg-[#007078]/5 peer-data-[state=checked]:shadow-sm [&:has([data-state=checked])]:border-[#007078] [&:has([data-state=checked])]:bg-[#007078]/5"
              >
                <span className="text-sm font-semibold">Graduated</span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {formatCurrency(BASE_RATES.GRADUATE.MONTHLY)}/month base
                </span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Payment Frequency */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            Payment Schedule
          </CardTitle>
          <CardDescription className="text-xs">
            How often would you like to be charged?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={paymentFrequency}
            onValueChange={(v) => setPaymentFrequency(v as PaymentFrequency)}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            <div>
              <RadioGroupItem
                value="MONTHLY"
                id="monthly"
                className="peer sr-only"
              />
              <Label
                htmlFor="monthly"
                className="flex cursor-pointer flex-col items-center justify-between rounded-lg border-2 border-muted bg-card p-3 transition-all hover:border-[#007078]/50 hover:bg-accent hover:shadow-md peer-data-[state=checked]:border-[#007078] peer-data-[state=checked]:bg-[#007078]/5 peer-data-[state=checked]:shadow-sm [&:has([data-state=checked])]:border-[#007078] [&:has([data-state=checked])]:bg-[#007078]/5"
              >
                <span className="text-sm font-semibold">Monthly</span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  Charged every month
                </span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="BI_MONTHLY"
                id="bi-monthly"
                className="peer sr-only"
              />
              <Label
                htmlFor="bi-monthly"
                className="flex cursor-pointer flex-col items-center justify-between rounded-lg border-2 border-muted bg-card p-3 transition-all hover:border-[#007078]/50 hover:bg-accent hover:shadow-md peer-data-[state=checked]:border-[#007078] peer-data-[state=checked]:bg-[#007078]/5 peer-data-[state=checked]:shadow-sm [&:has([data-state=checked])]:border-[#007078] [&:has([data-state=checked])]:bg-[#007078]/5"
              >
                <span className="text-sm font-semibold">Bi-Monthly</span>
                <span className="mt-0.5 text-xs font-medium text-green-600">
                  Save $10-$20/month
                </span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Pricing Summary */}
      <Card className="border-[#007078]/20 bg-[#007078]/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Your Tuition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold">Total</span>
            <div className="text-right">
              <span className="text-2xl font-bold text-[#007078]">
                {formatCurrency(calculatedRate)}
              </span>
              <span className="ml-1 text-xs text-muted-foreground">
                {billingPeriodText}
              </span>
            </div>
          </div>
          {paymentFrequency === 'BI_MONTHLY' && (
            <p className="mt-1 text-xs text-muted-foreground">
              Equivalent to {formatCurrency(monthlyEquivalent)}/month
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary Section */}
      <Card className="border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Summary</CardTitle>
          <CardDescription className="text-xs">
            Review your selections before proceeding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Education Status:</span>
            <span className="font-medium">
              {graduationStatus === 'NON_GRADUATE'
                ? 'Still in School'
                : 'Graduated'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment Schedule:</span>
            <span className="font-medium">
              {paymentFrequency === 'MONTHLY' ? 'Monthly' : 'Bi-Monthly'}
            </span>
          </div>
          <div className="flex justify-between border-t pt-1.5">
            <span className="font-semibold">Total:</span>
            <span className="text-base font-bold text-[#007078]">
              {formatCurrency(calculatedRate)}
              {billingPeriodText}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Checkout Button */}
      <Button
        onClick={handleCheckout}
        disabled={isLoading}
        className="w-full bg-[#007078] hover:bg-[#005a61]"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Setting up payment...
          </>
        ) : (
          `Continue to Payment - ${formatCurrency(calculatedRate)}${billingPeriodText}`
        )}
      </Button>
    </div>
  )
}
