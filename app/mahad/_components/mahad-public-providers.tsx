'use client'

import { AppErrorBoundary } from '@/components/error-boundary'

interface MahadPublicProvidersProps {
  children: React.ReactNode
  context?: string
}

/**
 * Inline error boundary for Mahad public flows. Toasts use the root `Toaster`
 * in `app/layout.tsx` — do not mount a second `Toaster` here.
 */
export function MahadPublicProviders({
  children,
  context = 'Mahad',
}: MahadPublicProvidersProps) {
  return (
    <AppErrorBoundary context={context} variant="inline">
      {children}
    </AppErrorBoundary>
  )
}
