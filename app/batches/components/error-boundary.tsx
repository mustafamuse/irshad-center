'use client'

import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

function ErrorFallback({ error }: { error: Error }) {
  console.error('BatchErrorBoundary caught error:', error)
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <h3 className="mb-2 text-sm font-medium text-red-800">Component Error</h3>
      <p className="mb-2 text-sm text-red-600">
        {error instanceof Error ? error.message : 'An error occurred'}
      </p>
      {error instanceof Error && error.stack && (
        <details className="text-xs text-red-500">
          <summary>Stack trace</summary>
          <pre className="mt-1 whitespace-pre-wrap">{error.stack}</pre>
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
      onReset={() => window.location.reload()}
    >
      {children}
    </ReactErrorBoundary>
  )
}
