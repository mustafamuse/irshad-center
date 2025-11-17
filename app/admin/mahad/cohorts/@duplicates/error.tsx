'use client'

import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * Duplicates Error Boundary
 *
 * Isolated error handling - if duplicate detection fails,
 * students and batches still work fine.
 */
export default function DuplicatesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Failed to Load Duplicate Detection</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p className="text-sm">
          {error.message || 'An error occurred while checking for duplicates'}
        </p>
        <Button onClick={reset} variant="outline" size="sm">
          Try Again
        </Button>
      </AlertDescription>
    </Alert>
  )
}
