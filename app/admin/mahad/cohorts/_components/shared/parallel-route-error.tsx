'use client'

import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * Reusable Error Component for Parallel Route Slots
 *
 * Provides consistent error handling across all parallel route slots
 * with isolated error boundaries (one slot failing doesn't crash the page).
 *
 * @param title - Error title to display
 * @param defaultMessage - Fallback message if error.message is empty
 * @param error - Error object from error boundary
 * @param reset - Function to retry/reset the error boundary
 */
export function ParallelRouteError({
  title,
  defaultMessage,
  error,
  reset,
}: {
  title: string
  defaultMessage: string
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p className="text-sm">{error.message || defaultMessage}</p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
        <Button onClick={reset} variant="outline" size="sm">
          Try Again
        </Button>
      </AlertDescription>
    </Alert>
  )
}
