'use client'

import { Toaster } from 'sonner'

import { AppErrorBoundary } from '@/components/error-boundary'

interface MahadPublicProvidersProps {
  children: React.ReactNode
  /**
   * Sentry / logger context label for the inline error boundary.
   * Defaults to `"Mahad"` so the same provider can wrap any Mahad public
   * page (register, students lookup, etc.).
   */
  context?: string
}

/**
 * Shared client-side providers for Mahad public pages: an inline error
 * boundary plus a Sonner toaster. Replaces the old `app/mahad/register/providers.tsx`
 * so sibling routes (e.g. `/mahad/students`) no longer reach across routes.
 */
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
