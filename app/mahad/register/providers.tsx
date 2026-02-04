'use client'

import { Toaster } from 'sonner'

import { AppErrorBoundary } from '@/components/error-boundary'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppErrorBoundary context="Mahad registration" variant="inline">
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
