'use client'

import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * Batches Error Boundary
 *
 * Isolated error handling - if batch management fails,
 * students and duplicates still work fine.
 */
export default function BatchesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Failed to Load Batch Management</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p className="text-sm">
          {error.message || 'An error occurred while loading batches'}
        </p>
        <Button onClick={reset} variant="outline" size="sm">
          Try Again
        </Button>
      </AlertDescription>
    </Alert>
  )
}
