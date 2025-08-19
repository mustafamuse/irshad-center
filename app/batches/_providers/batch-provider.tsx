'use client'

import { ReactNode, useEffect, useRef } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'sonner'

import { useBatchStore } from '../_store/batch.store'

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
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
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

  // Initialize data on mount
  const {
    setBatchesLoading,
    setBatchesError,
    setBatches,
    setStudentsLoading,
    setStudentsError,
    setStudents,
  } = useBatchStore()

  useEffect(() => {
    let mounted = true

    const loadInitialData = async () => {
      try {
        // Load batches
        setBatchesLoading(true, 'Loading batches...')
        const batchResponse = await fetch('/api/batches')
        const batchResult = await batchResponse.json()

        if (mounted) {
          if (batchResult.success && batchResult.data) {
            setBatches(batchResult.data)
            setBatchesError(null)
          } else {
            setBatchesError(batchResult.error || 'Failed to load batches')
          }
          setBatchesLoading(false)
        }

        // Load students
        setStudentsLoading(true, 'Loading students...')
        const studentResponse = await fetch('/api/batches/students')
        const studentResult = await studentResponse.json()

        if (mounted) {
          if (studentResult.success && studentResult.data) {
            setStudents(studentResult.data)
            setStudentsError(null)
          } else {
            setStudentsError(studentResult.error || 'Failed to load students')
          }
          setStudentsLoading(false)
        }
      } catch (error) {
        if (mounted) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error occurred'
          setBatchesError(errorMessage)
          setStudentsError(errorMessage)
          setBatchesLoading(false)
          setStudentsLoading(false)
        }
      }
    }

    loadInitialData()

    return () => {
      mounted = false
    }
  }, [
    setBatches,
    setBatchesError,
    setBatchesLoading,
    setStudents,
    setStudentsError,
    setStudentsLoading,
  ])

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
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
            },
          }}
        />
      </ErrorBoundary>
    </QueryClientProvider>
  )
}
