'use client'

import { useEffect, useState } from 'react'

import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'

// Get environment variables
const pricingTableId = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_PROD

if (!pricingTableId || !publishableKey) {
  throw new Error(
    'Stripe configuration is missing. Please check your environment variables.'
  )
}

export function StripePricingTable() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3

  useEffect(() => {
    let scriptElement: HTMLScriptElement | null = null

    const loadScript = () => {
      // Reset error state on retry
      setError(null)
      setIsLoading(true)

      // Create and configure script element
      scriptElement = document.createElement('script')
      scriptElement.src = 'https://js.stripe.com/v3/pricing-table.js'
      scriptElement.async = true

      // Handle successful load
      scriptElement.onload = () => {
        setIsLoading(false)
      }

      // Handle load error
      scriptElement.onerror = () => {
        const errorMsg = `Failed to load Stripe Pricing Table script (attempt ${retryCount + 1}/${MAX_RETRIES})`
        console.error(errorMsg)
        setError(errorMsg)
        setIsLoading(false)

        // Retry logic
        if (retryCount < MAX_RETRIES) {
          setTimeout(
            () => {
              setRetryCount((prev) => prev + 1)
            },
            Math.min(1000 * Math.pow(2, retryCount), 5000)
          ) // Exponential backoff
        }
      }

      // Add script to document
      document.head.appendChild(scriptElement)
    }

    loadScript()

    // Cleanup
    return () => {
      if (scriptElement && document.head.contains(scriptElement)) {
        document.head.removeChild(scriptElement)
      }
    }
  }, [retryCount]) // Retry when retryCount changes

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          {retryCount < MAX_RETRIES && ' - Retrying...'}
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-[#007078]"></div>
          <p className="text-sm text-muted-foreground">
            Loading payment options...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        className="min-h-[400px]"
        dangerouslySetInnerHTML={{
          __html: `
            <stripe-pricing-table 
              pricing-table-id="${pricingTableId}"
              publishable-key="${publishableKey}">
            </stripe-pricing-table>
          `,
        }}
      />
    </div>
  )
}
