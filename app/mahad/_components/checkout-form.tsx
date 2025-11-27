'use client'

/**
 * Mahad Checkout Form
 *
 * Custom checkout form that calculates tuition based on:
 * - Graduation status (still in school vs. graduated)
 * - Payment frequency (monthly vs. bi-monthly)
 * - Billing type (full-time, scholarship, part-time, exempt)
 *
 * Replaces the Stripe Pricing Table for dynamic pricing.
 */

import { useState, useMemo } from 'react'

import {
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'
import {
  Loader2,
  GraduationCap,
  Calendar,
  CreditCard,
  Info,
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Client-side rate calculation (mirrors server-side logic)
const BASE_RATES = {
  NON_GRADUATE: {
    MONTHLY: 12000, // $120
    BI_MONTHLY: 11000, // $110 per month
  },
  GRADUATE: {
    MONTHLY: 9500, // $95
    BI_MONTHLY: 9000, // $90 per month
  },
} as const

const SCHOLARSHIP_DISCOUNT = 3000 // $30

function calculateRate(
  graduationStatus: GraduationStatus,
  paymentFrequency: PaymentFrequency,
  billingType: StudentBillingType
): number {
  if (billingType === 'EXEMPT') return 0

  const baseRate = BASE_RATES[graduationStatus][paymentFrequency]
  let rate: number = baseRate

  if (billingType === 'PART_TIME') {
    rate = Math.floor(rate / 2)
  } else if (billingType === 'FULL_TIME_SCHOLARSHIP') {
    rate = rate - SCHOLARSHIP_DISCOUNT
  }

  // For bi-monthly, return total for 2 months
  if (paymentFrequency === 'BI_MONTHLY') {
    rate = rate * 2
  }

  return rate
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
  const [billingType, setBillingType] =
    useState<StudentBillingType>('FULL_TIME')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate the rate based on selections
  const calculatedRate = useMemo(() => {
    return calculateRate(graduationStatus, paymentFrequency, billingType)
  }, [graduationStatus, paymentFrequency, billingType])

  // Format the billing period text
  const billingPeriodText = useMemo(() => {
    if (billingType === 'EXEMPT') return 'No payment required'
    return paymentFrequency === 'MONTHLY' ? '/month' : '/2 months'
  }, [paymentFrequency, billingType])

  // Handle checkout
  const handleCheckout = async () => {
    if (billingType === 'EXEMPT') {
      // TODO: Handle exempt students differently
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/mahad/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          graduationStatus,
          paymentFrequency,
          billingType,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsLoading(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Student Info */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Setting up payment for
          </p>
          <p className="text-lg font-semibold">{studentName}</p>
        </div>

        {/* Graduation Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-4 w-4" />
              Education Status
            </CardTitle>
            <CardDescription>
              Have you completed your formal education?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={graduationStatus}
              onValueChange={(v) => setGraduationStatus(v as GraduationStatus)}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="NON_GRADUATE"
                  id="non-graduate"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="non-graduate"
                  className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-[#007078] [&:has([data-state=checked])]:border-[#007078]"
                >
                  <span className="font-medium">Still in School</span>
                  <span className="text-xs text-muted-foreground">
                    $120/month base
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
                  className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-[#007078] [&:has([data-state=checked])]:border-[#007078]"
                >
                  <span className="font-medium">Graduated</span>
                  <span className="text-xs text-muted-foreground">
                    $95/month base
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Payment Frequency */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Payment Schedule
            </CardTitle>
            <CardDescription>
              How often would you like to be charged?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={paymentFrequency}
              onValueChange={(v) => setPaymentFrequency(v as PaymentFrequency)}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="MONTHLY"
                  id="monthly"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="monthly"
                  className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-[#007078] [&:has([data-state=checked])]:border-[#007078]"
                >
                  <span className="font-medium">Monthly</span>
                  <span className="text-xs text-muted-foreground">
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
                  className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-[#007078] [&:has([data-state=checked])]:border-[#007078]"
                >
                  <span className="font-medium">Bi-Monthly</span>
                  <span className="text-xs text-muted-foreground">
                    Save $10-$20/month
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Billing Type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Enrollment Type
            </CardTitle>
            <CardDescription>Select your enrollment status</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={billingType}
              onValueChange={(v) => setBillingType(v as StudentBillingType)}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent">
                <RadioGroupItem value="FULL_TIME" id="full-time" />
                <Label htmlFor="full-time" className="flex-1 cursor-pointer">
                  <div className="font-medium">Full-Time Student</div>
                  <div className="text-xs text-muted-foreground">
                    Standard tuition rate
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent">
                <RadioGroupItem
                  value="FULL_TIME_SCHOLARSHIP"
                  id="scholarship"
                />
                <Label htmlFor="scholarship" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    Full-Time with Scholarship
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>$30/month discount for eligible students</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    $30 monthly discount applied
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent">
                <RadioGroupItem value="PART_TIME" id="part-time" />
                <Label htmlFor="part-time" className="flex-1 cursor-pointer">
                  <div className="font-medium">Part-Time Student</div>
                  <div className="text-xs text-muted-foreground">
                    50% of standard rate
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent">
                <RadioGroupItem value="EXEMPT" id="exempt" />
                <Label htmlFor="exempt" className="flex-1 cursor-pointer">
                  <div className="font-medium">Exempt (TA/Staff)</div>
                  <div className="text-xs text-muted-foreground">
                    No payment required
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Price Summary */}
        <Card className="border-[#007078]/20 bg-[#007078]/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">Your Tuition</span>
              <div className="text-right">
                <span className="text-3xl font-bold text-[#007078]">
                  {formatCurrency(calculatedRate)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {billingPeriodText}
                </span>
              </div>
            </div>
            {paymentFrequency === 'BI_MONTHLY' && billingType !== 'EXEMPT' && (
              <p className="mt-2 text-xs text-muted-foreground">
                Equivalent to {formatCurrency(calculatedRate / 2)}/month
              </p>
            )}
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
          disabled={isLoading || billingType === 'EXEMPT'}
          className="w-full bg-[#007078] hover:bg-[#005a61]"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting up payment...
            </>
          ) : billingType === 'EXEMPT' ? (
            'No Payment Required'
          ) : (
            `Continue to Payment - ${formatCurrency(calculatedRate)}${billingPeriodText}`
          )}
        </Button>

        {billingType === 'EXEMPT' && (
          <Alert className="border-[#deb43e]/20 bg-[#deb43e]/5">
            <Info className="h-4 w-4 text-[#deb43e]" />
            <AlertDescription className="text-[#deb43e]">
              As an exempt student, no payment setup is required. Please contact
              the administration to complete your registration.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </TooltipProvider>
  )
}
