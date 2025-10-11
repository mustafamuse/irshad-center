'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

import { ErrorBoundary } from '../../mahad/register/components/error-boundary'

const queryClient = new QueryClient()

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'white',
              color: '#374151',
              border: '1px solid #e5e7eb',
            },
          }}
        />
      </ErrorBoundary>
    </QueryClientProvider>
  )
}
