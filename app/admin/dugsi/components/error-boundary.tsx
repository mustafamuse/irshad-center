'use client'

import { AlertTriangle } from 'lucide-react'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  console.error('DugsiDashboardErrorBoundary caught error:', error)

  return (
    <Card className="border-destructive">
      <CardHeader>
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <CardTitle>Something went wrong</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          An error occurred while loading the Dugsi admin dashboard. This might
          be due to a data loading issue or a component error.
        </p>
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">Error Details</p>
          <p className="mt-1 text-xs text-red-600">
            {error instanceof Error
              ? error.message
              : 'An unknown error occurred'}
          </p>
        </div>
        {error instanceof Error && error.stack && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Show technical details
            </summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-md border bg-muted p-2 text-xs">
              {error.stack}
            </pre>
          </details>
        )}
        <div className="flex gap-2">
          <Button onClick={resetErrorBoundary} variant="default">
            Try Again
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline">
            Reload Page
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface DugsiErrorBoundaryProps {
  children: React.ReactNode
}

export function DugsiErrorBoundary({ children }: DugsiErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      {children}
    </ReactErrorBoundary>
  )
}

