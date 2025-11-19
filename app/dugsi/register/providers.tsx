'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ErrorBoundary } from '@/app/mahad/(registration)/register/_components/error-boundary'
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
          <ErrorBoundary>{children}</ErrorBoundary>
        </IntlProviderWrapper>
      </LanguageProvider>
    </QueryClientProvider>
  )
}
