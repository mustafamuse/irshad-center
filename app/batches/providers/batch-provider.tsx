'use client'

import { ReactNode, useRef } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'

/**
 * BatchProvider - Simplified to only provide QueryClient
 *
 * Data fetching has been moved to Server Components.
 * This provider only sets up React Query for client-side mutations.
 */

// Error fallback component
function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error
  resetErrorBoundary: () => void
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 p-8">
      <div className="text-center">
        <h2 className="mb-2 text-lg font-semibold text-destructive">
          Something went wrong
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {error.message ||
            'An unexpected error occurred in the batch management system.'}
        </p>
        <button
          onClick={resetErrorBoundary}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

// Query client configuration
const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0, // Server Components handle data freshness
        gcTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          if (error instanceof Error && error.message.includes('4')) {
            return false
          }
          return failureCount < 3
        },
      },
      mutations: {
        retry: false,
      },
    },
  })
}

interface BatchProviderProps {
  children: ReactNode
}

export function BatchProvider({ children }: BatchProviderProps) {
  const queryClientRef = useRef<QueryClient>()

  if (!queryClientRef.current) {
    queryClientRef.current = createQueryClient()
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          // Reset any necessary state
          queryClientRef.current?.clear()
        }}
      >
        {children}
      </ErrorBoundary>
    </QueryClientProvider>
  )
}
