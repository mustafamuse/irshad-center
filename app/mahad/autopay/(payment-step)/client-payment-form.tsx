'use client'

import { useMemo, useEffect, useState } from 'react'

import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { LockIcon, ShieldCheck } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { StudentDTO } from '@/lib/actions/get-students'
import { PayorDetails } from '@/lib/types'

import { StripePaymentForm } from './stripe-payment-form'
import { EnrollmentSummary } from '../(enrollment)/enrollment-summary'

// Get the publishable key from env
const publishableKey =
  process.env.NODE_ENV === 'production'
    ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_PROD
    : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_DEV

if (!publishableKey) {
  throw new Error('Stripe publishable key is not set in environment variables')
}

interface ClientPaymentFormProps {
  clientSecret: string
  payorDetails: PayorDetails
  selectedStudents: StudentDTO[]
  onAddStudents: () => void
}

export function ClientPaymentForm({
  clientSecret,
  payorDetails,
  selectedStudents,
  onAddStudents,
}: ClientPaymentFormProps) {
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [isStripeLoading, setIsStripeLoading] = useState(true)

  // Memoize the Stripe promise with error handling
  const stripePromise = useMemo(() => {
    console.log(
      'Initializing Stripe with publishable key:',
      publishableKey?.substring(0, 8) + '...'
    )
    setIsStripeLoading(true)

    try {
      const promise = loadStripe(publishableKey!)
      promise.then(
        (stripe) => {
          console.log('Stripe loaded successfully:', !!stripe)
          setIsStripeLoading(false)
        },
        (error) => {
          console.error('Failed to load Stripe:', error)
          setStripeError(`Failed to load Stripe: ${error.message}`)
          setIsStripeLoading(false)
        }
      )
      return promise
    } catch (error) {
      console.error('Error initializing Stripe:', error)
      setStripeError(
        `Error initializing Stripe: ${error instanceof Error ? error.message : String(error)}`
      )
      setIsStripeLoading(false)
      return Promise.reject(error)
    }
  }, [])

  // Log payor details for debugging
  useEffect(() => {
    console.log('ClientPaymentForm - Raw payorDetails:', {
      firstName: payorDetails.firstName,
      lastName: payorDetails.lastName,
      email: payorDetails.email,
      phone: payorDetails.phone,
      relationship: payorDetails.relationship,
    })
  }, [payorDetails])

  return (
    <Card className="relative">
      <div className="absolute right-4 top-4 flex items-center text-sm text-muted-foreground">
        <LockIcon className="mr-1 h-4 w-4" />
        Secure Payment
      </div>
      <CardHeader>
        <CardTitle>Payment Details</CardTitle>
        <CardDescription className="mt-2">
          Set up automatic monthly tuition payments from your bank account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-card p-4">
          <EnrollmentSummary
            selectedStudents={selectedStudents}
            onAddStudents={onAddStudents}
          />
        </div>

        {/* Payment Info */}
        <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
          <h3 className="font-medium">Payment Information</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center">
              <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />
              Secure bank-to-bank transfer (ACH)
            </li>
            <li className="flex items-center">
              <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />
              No processing fees
            </li>
            <li className="flex items-center">
              <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />
              Cancel anytime with no penalties
            </li>
          </ul>
        </div>

        <Separator />

        {stripeError && (
          <Alert variant="destructive">
            <AlertDescription>{stripeError}</AlertDescription>
          </Alert>
        )}

        {isStripeLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
            <p className="mt-4 text-sm text-muted-foreground">
              Loading payment form...
            </p>
          </div>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
              },
            }}
          >
            <StripePaymentForm
              clientSecret={clientSecret}
              payorDetails={{
                email: payorDetails.email || '',
                name:
                  payorDetails.firstName && payorDetails.lastName
                    ? `${payorDetails.firstName} ${payorDetails.lastName}`
                    : '',
                phone: payorDetails.phone || '',
              }}
              studentIds={selectedStudents.map((student) => student.id)}
            />
          </Elements>
        )}
      </CardContent>
    </Card>
  )
}