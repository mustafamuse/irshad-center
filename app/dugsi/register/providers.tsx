'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AppErrorBoundary } from '@/components/error-boundary'
import { IntlProviderWrapper } from '@/components/intl-provider-wrapper'
import { LanguageProvider } from '@/contexts/language-context'

const queryClient = new QueryClient()

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <IntlProviderWrapper>
          <AppErrorBoundary context="Dugsi registration" variant="inline">
            {children}
          </AppErrorBoundary>
        </IntlProviderWrapper>
      </LanguageProvider>
    </QueryClientProvider>
  )
}
