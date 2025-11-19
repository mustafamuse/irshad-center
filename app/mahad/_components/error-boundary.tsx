'use client'

import { AlertTriangle } from 'lucide-react'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Error fallback UI for mahad section
 * Displays user-friendly error message with recovery options
 */
function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error
  resetErrorBoundary: () => void
}) {
  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-center text-destructive">
            Something went wrong
          </CardTitle>
          <CardDescription className="text-center">
            An unexpected error occurred in the Mahad section
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => resetErrorBoundary()} variant="default">
              Try again
            </Button>
            <Button
              onClick={() => (window.location.href = '/')}
              variant="outline"
            >
              Go home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Root error boundary for mahad section
 * Catches uncaught errors and provides recovery UI
 *
 * @example
 * <MahadErrorBoundary>
 *   <YourComponent />
 * </MahadErrorBoundary>
 */
export function MahadErrorBoundary({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  )
}
