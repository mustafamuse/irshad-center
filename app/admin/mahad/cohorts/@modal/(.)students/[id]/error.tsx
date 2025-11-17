'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { AlertCircle, RefreshCw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Error boundary for the student detail modal route.
 *
 * This component handles errors that occur within the intercepting modal route,
 * providing a user-friendly error state within the modal context rather than
 * replacing the entire page.
 */
export default function StudentDetailModalError({ error, reset }: ErrorProps) {
  const router = useRouter()

  // Log error to console in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Student detail modal error:', error)
    }
  }, [error])

  const handleClose = () => {
    // Navigate back to the cohorts list
    router.back()
  }

  const handleRetry = () => {
    // Reset the error boundary and try rendering again
    reset()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-md"
        aria-labelledby="error-title"
        aria-describedby="error-description"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <DialogTitle id="error-title">
              Unable to Load Student Details
            </DialogTitle>
          </div>
          <DialogDescription id="error-description" className="mt-2">
            {error.message === 'Student not found' ? (
              <>
                The student you're looking for could not be found. They may have
                been removed or you may not have permission to view their
                details.
              </>
            ) : (
              <>
                We encountered an error while loading the student details. This
                could be due to a network issue or a temporary problem with our
                servers.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Error details in development mode */}
        {process.env.NODE_ENV === 'development' && (
          <div className="rounded-md bg-muted p-3 text-xs">
            <p className="font-semibold">Error Details:</p>
            <p className="mt-1 font-mono">{error.message}</p>
            {error.digest && (
              <p className="mt-1 text-muted-foreground">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleClose}
            className="w-full sm:w-auto"
          >
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
          <Button onClick={handleRetry} className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
