'use client'

import { AlertTriangle } from 'lucide-react'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

import { Button } from '@/components/ui/button'

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error
  resetErrorBoundary: () => void
}) {
  return (
    <div className="rounded-lg border border-destructive/50 p-6">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <h3 className="font-medium">Something went wrong</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button variant="outline" onClick={resetErrorBoundary} className="mt-4">
        Try again
      </Button>
    </div>
  )
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  )
}
