'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

import { Button } from '@/components/ui/button'

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error
  resetErrorBoundary: () => void
}) {
  console.error('BatchErrorBoundary caught error:', error)

  // Detect database/query errors
  const isDatabaseError =
    error.message.includes('Prisma') ||
    error.message.includes('database') ||
    error.message.includes('connection')

  const isNotFoundError = error.message.includes('not found')

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
      <AlertCircle className="mb-4 h-10 w-10 text-destructive" />

      <h3 className="mb-2 text-lg font-semibold text-destructive">
        {isDatabaseError
          ? 'Database Connection Error'
          : isNotFoundError
            ? 'Not Found'
            : 'Something Went Wrong'}
      </h3>

      <p className="mb-4 max-w-md text-sm text-muted-foreground">
        {isDatabaseError ? (
          <>
            We couldn't connect to the database. This might be a temporary
            network issue. Please try again in a moment.
          </>
        ) : isNotFoundError ? (
          <>
            The resource you're looking for could not be found. It may have been
            removed or you may not have permission to access it.
          </>
        ) : (
          <>
            An unexpected error occurred while loading this content. The error
            has been logged and we're working to fix it.
          </>
        )}
      </p>

      <div className="flex gap-2">
        <Button onClick={resetErrorBoundary} size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (window.location.href = '/admin/mahad/cohorts')}
        >
          Go to Cohorts
        </Button>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <details className="mt-6 max-w-2xl text-left">
          <summary className="cursor-pointer text-sm font-medium text-destructive">
            Error Details (Development Only)
          </summary>
          <div className="mt-2 rounded-md bg-muted p-3">
            <p className="font-mono text-xs text-destructive">
              {error.message}
            </p>
            {error.stack && (
              <pre className="mt-2 max-h-40 overflow-auto text-xs text-muted-foreground">
                {error.stack}
              </pre>
            )}
          </div>
        </details>
      )}
    </div>
  )
}

export function BatchErrorBoundary({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Clear any stale state and retry
        window.location.reload()
      }}
    >
      {children}
    </ReactErrorBoundary>
  )
}
