'use client'

import { Toaster } from 'sonner'

import { AppErrorBoundary } from '@/components/error-boundary'

interface MahadPublicProvidersProps {
  children: React.ReactNode
  context?: string
}

export function MahadPublicProviders({
  children,
  context = 'Mahad',
}: MahadPublicProvidersProps) {
  return (
    <AppErrorBoundary context={context} variant="inline">
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
    </AppErrorBoundary>
  )
}
