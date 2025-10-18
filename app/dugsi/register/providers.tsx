'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ErrorBoundary } from '../../mahad/register/components/error-boundary'

const queryClient = new QueryClient()

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </QueryClientProvider>
  )
}
