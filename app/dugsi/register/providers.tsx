'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { IntlProviderWrapper } from '@/components/intl-provider-wrapper'
import { LanguageProvider } from '@/contexts/language-context'

import { ErrorBoundary } from '../../mahad/register/components/error-boundary'

const queryClient = new QueryClient()

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <IntlProviderWrapper>
          <ErrorBoundary>{children}</ErrorBoundary>
        </IntlProviderWrapper>
      </LanguageProvider>
    </QueryClientProvider>
  )
}
